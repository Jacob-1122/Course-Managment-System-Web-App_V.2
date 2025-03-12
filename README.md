# Course Management System

A modern web application for managing academic courses, built with React, TypeScript, and Supabase. This system provides different interfaces for administrators, instructors, and students to manage courses, enrollments, and academic activities.

## 🚀 Features

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

## 📁 Project Structure

```
Course-Management-System-Web-App/
├── src/
│   ├── components/           # React components
│   │   ├── AdminDashboard.tsx       # Admin interface
│   │   ├── InstructorDashboard.tsx  # Instructor interface
│   │   ├── StudentDashboard.tsx     # Student interface
│   │   ├── AddCourseModal.tsx       # Course creation modal
│   │   ├── EditCourseModal.tsx      # Course editing modal
│   │   └── ...
│   ├── lib/
│   │   └── supabase.ts      # Supabase client configuration
│   ├── store/
│   │   └── authStore.ts     # Authentication state management
│   ├── types/
│   │   └── index.ts         # TypeScript type definitions
│   └── App.tsx              # Main application component
├── public/                  # Static assets
└── package.json            # Project dependencies
```

## 🔧 Component Overview

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

## 🗄️ Database Structure

The application uses Supabase with the following main tables:

- **courses**: Course information and metadata
- **enrollments**: Student course enrollments
- **profiles**: User profiles and roles
- **instructors**: Instructor information
- **logs**: System activity logging

## 🛠️ Setup and Installation

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

## 🔐 Environment Variables

Required environment variables:

- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous key

## 🚀 Deployment

1. Build the project:
```bash
npm run build
```

2. Deploy the `dist` folder to your hosting service of choice.

## 📝 Database Setup

Required Supabase tables and policies:

```sql
-- Create courses table
CREATE TABLE courses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT,
  department TEXT,
  instructor_id UUID REFERENCES profiles(id),
  max_capacity INTEGER DEFAULT 50,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Create enrollments table
CREATE TABLE course_enrollments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  course_id UUID REFERENCES courses(id),
  student_id UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Create activity logs table
CREATE TABLE logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  action TEXT NOT NULL,
  performed_by UUID REFERENCES auth.users(id),
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
