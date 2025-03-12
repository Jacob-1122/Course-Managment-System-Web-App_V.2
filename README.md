# Course Management System

This web application is engineered to manage academic courses effectively, utilizing React, TypeScript, and Supabase. The system offers tailored interfaces for administrators, instructors, and students to manage courses, enrollments, and other academic activities seamlessly.

## Hosted Side (Still In Development): https://coursemanagment.netlify.app

## Features

### Role-Based Access Control
- **Admin**: Complete control over all courses, instructors, and system-wide settings.
- **Instructor**: Responsible for managing assigned courses and student enrollments.
- **Student**: Ability to browse courses, enroll, and monitor academic progress.

### Real-Time Updates
- Tracks enrollments live.
- Notifications for course updates as they happen.
- Logs activities in real time.

### Course Management
- Facilities to create and modify course details.
- Monitors enrollment statistics.
- Manages course schedules and capacities.
- Handles prerequisites and course syllabi.

## Project Structure

```
Course-Management-System-Web-App/
├── src/
│   ├── components/           # React components
│   ├── lib/                 # Supabase client configuration
│   ├── store/
│   │   └── authStore.ts     # Authentication state management
│   ├── Pages/               # Dashboard and Login
│   ├── App.tsx              # Main application component
│   ├── tyoe.ts              # Type Defenitions
│   ├── vite-env.d.ts        # Reference file
├── Supabase/                # migrations
├── scripts/
│   └── setup-db.js           # Database initialization script
└── package.json              # Manages project dependencies
```

## Component Overview

### Core Components
- **AdminDashboard**: Manages courses and assigns instructors; also handles monitoring and analytics.
- **InstructorDashboard**: Manages course creation and enrollment, provides course statistics and data export.
- **StudentDashboard**: Enables course browsing and enrollment, along with schedule and progress tracking.
- **EditCourseModal**: Allows editing of course details such as schedule, capacity, and prerequisites.

### Data Types

```typescript
// Core interfaces used throughout the application
interface Course {
  id: string;
  name: string;
  code?: string;
  department: string;
  instructor_id: string;
  max_capacity: number;
  status: 'active' | 'inactive' | 'archived' | 'draft';
}

interface Enrollment {
  id: string;
  course_id: string;
  student_id: string;
  status: 'enrolled' | 'waitlisted' | 'completed';
}

interface User {
  id: string;
  email: string;
  role: 'admin' | 'student' | 'instructor';
}
```

## Setup and Installation

1. Clone the repository and navigate to the project directory:
```bash
git clone https://github.com/yourusername/Course-Management-System-Web-App.git
cd Course-Management-System-Web-App
```

2. Install project dependencies:
```bash
npm install
```

3. Set up your environment by creating a .env file with your Supabase credentials:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_SUPABASE_SERVICE_KEY=your_supabase_service_key
```

4. Start the development server:
```bash
npm run dev
```

## Automated Supabase Setup

The system includes an automated setup process that runs during the first build or can be triggered manually:

```bash
npm run setup-db
```

This script:
1. Creates all required database tables
2. Configures Row Level Security policies
3. Sets up necessary triggers and functions
4. Creates storage buckets
5. Initializes an admin account for first login

You can find this script in the `scripts/setup-db.js` file.

### What Gets Set Up Automatically

- **Database Tables**: Users/profiles, courses, enrollments, prerequisites, activity logs
- **Security Policies**: Appropriate RLS policies for each table
- **Storage Buckets**: For course materials, assignments, and profile images
- **Initial Admin Account**: Created for first-time login

## Manual Supabase Setup (if needed)

If you prefer to set up your Supabase instance manually, follow these steps:

### 1. Create a Supabase Project

1. Sign up or log in to [Supabase](https://supabase.com)
2. Create a new project and note your project URL and anon key

### 2. Database Tables Setup

Execute the following SQL in the Supabase SQL Editor:

```sql
-- Users table (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'instructor', 'student')),
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Courses table
CREATE TABLE public.courses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT,
  department TEXT NOT NULL,
  description TEXT,
  instructor_id UUID REFERENCES public.profiles(id),
  max_capacity INTEGER NOT NULL,
  current_enrollment INTEGER DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'archived', 'draft')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Enrollments table
CREATE TABLE public.enrollments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('enrolled', 'waitlisted', 'completed')),
  enrollment_date TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(course_id, student_id)
);

-- Activity logs
CREATE TABLE public.activity_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Course prerequisites
CREATE TABLE public.prerequisites (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  prerequisite_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(course_id, prerequisite_id)
);
```

### 3. Set Up Row Level Security (RLS)

Configure security policies:

```sql
-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prerequisites ENABLE ROW LEVEL SECURITY;

-- Profiles table policies
CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update their own profiles"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Courses table policies
CREATE POLICY "Courses are viewable by everyone"
  ON public.courses FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert courses"
  ON public.courses FOR INSERT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Instructors can update their courses"
  ON public.courses FOR UPDATE
  USING (
    instructor_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

## Deployment

Build the application and deploy the dist folder to your preferred hosting service:
```bash
npm run build
```

The first build process will automatically initialize the Supabase database if it hasn't been set up yet.

## Implementing the Database Setup Script

To implement the automated setup, add these files to your project:

### 1. Add to package.json:
```json
"scripts": {
  "dev": "vite",
  "build": "node scripts/setup-db.js && tsc && vite build",
  "setup-db": "node scripts/setup-db.js",
  "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
  "preview": "vite preview"
}
```

### 2. Create the setup-db.js script
See the automated setup script section below for implementation details.

## Contributing
Contributions are welcomed. Fork the repository, create a feature branch, and submit your changes through a pull request.

## License
This project is licensed under the MIT License - see the LICENSE file for details.
