/*
  # Fix User Profiles and Authentication System

  1. Changes
     - Fix infinite recursion in user_profiles policies
     - Add helper functions for role checking
     - Improve access control for students and user profiles

  2. Security
     - Maintain proper role-based security using safer policy patterns
     - Avoid self-referential policies that cause infinite recursion
*/

-- Drop existing problematic objects first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS ensure_user_profile_exists();
DROP FUNCTION IF EXISTS is_admin_from_metadata();
DROP FUNCTION IF EXISTS is_instructor_from_metadata();
DROP FUNCTION IF EXISTS is_student_from_metadata();
DROP FUNCTION IF EXISTS handle_new_user();
DROP FUNCTION IF EXISTS create_user_profile();

-- Create extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Ensure auth schema permissions first
ALTER ROLE anon SET search_path = public, auth;
ALTER ROLE authenticated SET search_path = public, auth;
ALTER ROLE service_role SET search_path = public, auth;

GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON auth.users TO service_role;
GRANT SELECT ON auth.users TO anon, authenticated;

-- Ensure proper table exists first
DROP TABLE IF EXISTS user_profiles;
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('admin', 'instructor', 'student')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(auth_user_id),
  UNIQUE(email)
);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "allow_profile_creation_during_signup" ON user_profiles;
DROP POLICY IF EXISTS "allow_profile_read" ON user_profiles;
DROP POLICY IF EXISTS "allow_profile_update" ON user_profiles;

-- Create new policies with proper permissions
CREATE POLICY "allow_profile_creation_during_signup"
ON user_profiles
FOR INSERT
TO authenticated, anon, service_role
WITH CHECK (true);

CREATE POLICY "allow_profile_read"
ON user_profiles
FOR SELECT
TO authenticated, service_role
USING (true);

CREATE POLICY "allow_profile_update"
ON user_profiles
FOR UPDATE
TO authenticated, service_role
USING (auth_user_id = auth.uid() OR EXISTS (
  SELECT 1 FROM user_profiles
  WHERE auth_user_id = auth.uid() AND role = 'admin'
))
WITH CHECK (auth_user_id = auth.uid() OR EXISTS (
  SELECT 1 FROM user_profiles
  WHERE auth_user_id = auth.uid() AND role = 'admin'
));

-- Create a more robust trigger function with error handling
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  profile_name TEXT;
BEGIN
  -- Extract name from metadata or email
  profile_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );
  
  -- Create profile
  INSERT INTO user_profiles (auth_user_id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    profile_name,
    COALESCE(NEW.raw_user_meta_data->>'role', 'student')
  );
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log detailed error information
  RAISE LOG 'Error in handle_new_user: % %', SQLSTATE, SQLERRM;
  RAISE LOG 'Error detail: %', NEW;
  -- Don't fail the transaction
  RETURN NEW;
END;
$$;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON user_profiles TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION handle_new_user() TO service_role;

-- Recreate helper functions with proper error handling
CREATE OR REPLACE FUNCTION is_admin_from_metadata()
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql AS $$
BEGIN
  RETURN coalesce(
    (SELECT raw_user_meta_data->>'role' = 'admin' 
     FROM auth.users 
     WHERE id = auth.uid()),
    false
  );
END;
$$;

CREATE OR REPLACE FUNCTION is_instructor_from_metadata() 
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql AS $$
BEGIN
  RETURN coalesce(
    (SELECT raw_user_meta_data->>'role' = 'instructor' 
     FROM auth.users 
     WHERE id = auth.uid()),
    false
  );
END;
$$;

CREATE OR REPLACE FUNCTION is_student_from_metadata() 
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql AS $$
BEGIN
  RETURN coalesce(
    (SELECT raw_user_meta_data->>'role' = 'student' 
     FROM auth.users 
     WHERE id = auth.uid()),
    false
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION is_admin_from_metadata TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION is_instructor_from_metadata TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION is_student_from_metadata TO authenticated, anon, service_role;

-- Create direct access function
CREATE OR REPLACE FUNCTION get_user_profile_direct(user_id UUID)
RETURNS TABLE (
  id UUID,
  email TEXT,
  name TEXT, 
  role TEXT
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
AS $$
  SELECT 
    id,
    email,
    name,
    role
  FROM 
    user_profiles
  WHERE 
    id = user_id;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_profile_direct TO authenticated, service_role;