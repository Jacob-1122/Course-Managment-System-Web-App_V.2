export interface Course {
  id: string;
  name: string;
  code?: string;
  department: string;
  description?: string;
  instructor_id: string;
  instructor?: string;
  max_capacity: number;
  current_enrollment: number;
  pending_enrollments: number;
  total_enrollments: number;
  status: 'active' | 'inactive' | 'archived' | 'draft';
  created_at: string;
  updated_at: string;
  start_date?: string;
  end_date?: string;
  schedule?: string;
  location?: string;
  prerequisites?: string;
  syllabus_url?: string;
  credits: number;
  enrollments?: Array<{
    id: string;
    status: 'active' | 'pending' | 'dropped';
    student: {
      id: string;
      name: string;
      email: string;
    };
  }>;
}

export interface Student {
  id: string;
  name: string;
  email: string;
  profile_url?: string;
  academic_status?: string;
  created_at: string;
}

export interface Enrollment {
  id: string;
  course_id: string;
  student_id: string;
  status: 'enrolled' | 'waitlisted' | 'completed';
  enrollment_status: 'pending' | 'enrolled' | 'waitlisted' | 'completed' | 'dropped';
  enrollment_date: string;
  last_accessed: string;
  created_at: string;
  courses?: Course;
  students?: Student;
}

export interface User {
  id: string;
  email: string;
  role: 'admin' | 'student' | 'instructor';
  name?: string;
  profile_url?: string;
}

export interface Log {
  id: string;
  action: string;
  performed_by: string;
  details: any;
  created_at: string;
}

export interface Instructor {
  id: string;
  name: string;
  department: string;
  title?: string;
  specialization?: string[];
  office_hours?: any;
  contact_info?: any;
  created_at: string;
}