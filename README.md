# Course Management System

A modern web application for managing academic courses, built with React, TypeScript, and Supabase. This system provides different interfaces for administrators, instructors, and students to manage courses, enrollments, and academic activities.

## Features

- **Role-Based Access Control**
  - Admin: Manage all courses, instructors, and system-wide settings
  - Instructor: Manage assigned courses and student enrollments
  - Student: Browse courses, enroll, and track academic progress

- **Real-Time Updates**
  - Live enrollment tracking
  - Instant notification of course changes
  - Real-time activity logging

- **Course Management**
  - Create and edit courses
  - Track enrollment statistics
  - Manage course schedules and capacity
  - Handle prerequisites and syllabus

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
└── package.json            # Project dependencies
...
```

## Component Overview

### Core Components

1. **AdminDashboard**
   - System-wide course management
   - Instructor assignment
   - Activity monitoring
   - Analytics dashboard

2. **InstructorDashboard**
   - Course creation and management
   - Student enrollment tracking
   - Course statistics
   - Export enrollment data

3. **StudentDashboard**
   - Course browsing and enrollment
   - Schedule viewing
   - Progress tracking

4. **EditCourseModal**
   - Course details editing
   - Schedule management
   - Capacity control
   - Prerequisites setting

### Data Types

```typescript
// Key interfaces used throughout the application

interface Course {
  id: string;
  name: string;
  code?: string;
  department: string;
  instructor_id: string;
  max_capacity: number;
  status: 'active' | 'inactive' | 'archived' | 'draft';
  // ... additional fields
}

interface Enrollment {
  id: string;
  course_id: string;
  student_id: string;
  status: 'enrolled' | 'waitlisted' | 'completed';
  // ... additional fields
}

interface User {
  id: string;
  email: string;
  role: 'admin' | 'student' | 'instructor';
  // ... additional fields
}
```

## Database Structure

The application uses Supabase with the following main tables:

- **courses**: Course information and metadata
- **enrollments**: Student course enrollments
- **profiles**: User profiles and roles
- **instructors**: Instructor information
- **logs**: System activity logging

## Setup and Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/Course-Management-System-Web-App.git
cd Course-Management-System-Web-App
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file with your Supabase credentials:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Start the development server:
```bash
npm run dev
```

## Environment Variables

Required environment variables:

- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous key

## Deployment

1. Build the project:
```bash
npm run build
```

2. Deploy the `dist` folder to your hosting service of choice.

## Database Setup

Required Supabase tables and policies:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    auth_user_id UUID REFERENCES auth.users(id),
    name TEXT,
    email TEXT UNIQUE,
    role TEXT CHECK (role IN ('admin', 'instructor', 'student'))
);

-- Create instructors table
CREATE TABLE IF NOT EXISTS instructors (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    auth_user_id UUID REFERENCES auth.users(id),
    name TEXT NOT NULL,
    department TEXT,
    status TEXT DEFAULT 'active'
);

-- Create courses table
CREATE TABLE IF NOT EXISTS courses (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT,
    department TEXT,
    instructor_id UUID REFERENCES instructors(id),
    instructor TEXT NOT NULL,
    max_capacity INTEGER DEFAULT 50,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create enrollments table
CREATE TABLE IF NOT EXISTS course_enrollments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    course_id UUID REFERENCES courses(id),
    student_id UUID REFERENCES profiles(id),
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create activity logs table
CREATE TABLE IF NOT EXISTS logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    action TEXT NOT NULL,
    performed_by UUID REFERENCES auth.users(id),
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Set up Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE instructors ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;

-- Create policies for profiles
CREATE POLICY "Users can view their own profile"
ON profiles FOR SELECT
USING (auth_user_id = auth.uid());

CREATE POLICY "Admins can view all profiles"
ON profiles FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE auth_user_id = auth.uid()
        AND role = 'admin'
    )
);

-- Create policies for instructors
CREATE POLICY "Instructors can view and update their own profile"
ON instructors FOR ALL
USING (auth_user_id = auth.uid());

CREATE POLICY "Admins can manage all instructors"
ON instructors FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE auth_user_id = auth.uid()
        AND role = 'admin'
    )
);

-- Create policies for courses
CREATE POLICY "Anyone can view courses"
ON courses FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Instructors can manage their courses"
ON courses FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM instructors
        WHERE auth_user_id = auth.uid()
        AND id = courses.instructor_id
    )
    OR
    EXISTS (
        SELECT 1 FROM profiles
        WHERE auth_user_id = auth.uid()
        AND role = 'admin'
    )
);

-- Create policies for enrollments
CREATE POLICY "Students can view their enrollments"
ON course_enrollments FOR SELECT
USING (
    student_id IN (
        SELECT id FROM profiles
        WHERE auth_user_id = auth.uid()
    )
    OR
    EXISTS (
        SELECT 1 FROM courses
        WHERE id = course_enrollments.course_id
        AND instructor_id IN (
            SELECT id FROM instructors
            WHERE auth_user_id = auth.uid()
        )
    )
    OR
    EXISTS (
        SELECT 1 FROM profiles
        WHERE auth_user_id = auth.uid()
        AND role = 'admin'
    )
);

CREATE POLICY "Students can create their own enrollments"
ON course_enrollments FOR INSERT
WITH CHECK (
    auth.uid() IN (
        SELECT auth_user_id FROM profiles
        WHERE id = course_enrollments.student_id
    )
);

-- Create policies for logs
CREATE POLICY "Users can view relevant logs"
ON logs FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE auth_user_id = auth.uid()
        AND (role = 'admin' OR role = 'instructor')
    )
);
```

After setting up the tables, run the demo data script to populate the database with sample data:

```bash
psql -h db.xxxxxxxxxxxx.supabase.co -d postgres -U postgres -f demo-data.sql
```

## 🎮 Demo Account Setup

1. First, create these (or use the hardcoded) users in Supabase Authentication:
```
Admin:
Email: admin@demo.com
Password: demo123456

Instructor:
Email: instructor@demo.com
Password: demo123456

Student:
Email: student@demo.com
Password: demo123456
```

2. Run the demo data script:
```bash
psql -h YOUR_SUPABASE_HOST -d postgres -U postgres -f demo-data.sql
```

The script will:
- Create profiles for all demo users
- Set up a demo instructor
- Create 4 demo courses
- Create enrollments for the demo student
- Generate sample activity logs

### Demo Courses

1. Introduction to Programming (CS101)
   - Instructor: Demo Instructor
   - Department: Computer Science
   - Capacity: 30 students

2. Web Development (CS201)
   - Instructor: Demo Instructor
   - Department: Computer Science
   - Capacity: 25 students

3. Data Structures (CS301)
   - Instructor: Demo Instructor
   - Department: Computer Science
   - Capacity: 20 students

4. Machine Learning (CS401)
   - Instructor: Demo Instructor
   - Department: Computer Science
   - Capacity: 15 students

### Testing the Demo

1. Log in as the admin (admin@demo.com) to:
   - View all courses
   - Monitor system activity
   - Manage instructors

2. Log in as the instructor (instructor@demo.com) to:
   - Manage demo courses
   - View student enrollments
   - Track course statistics

3. Log in as the student (student@demo.com) to:
   - View enrolled courses
   - Browse available courses
   - Track academic progress

To reset the demo data at any time, simply run the demo-data.sql script again.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- React Team for the amazing framework
- Supabase Team for the backend infrastructure
- TailwindCSS Team for the styling framework
- All contributors and users of this system
