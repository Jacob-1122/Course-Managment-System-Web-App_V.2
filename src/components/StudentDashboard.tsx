import React, { useState, useEffect } from 'react';
import { Search, Clock, BookOpen } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Course, Enrollment } from '../types';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

const DEPARTMENTS = [
  { name: 'Computer Science', prefix: 'COSC' },
  { name: 'Mathematics', prefix: 'MATH' },
  { name: 'English', prefix: 'ENGL' },
  { name: 'Kinesiology', prefix: 'KINE' },
  { name: 'Biology', prefix: 'BIOL' },
  { name: 'Chemistry', prefix: 'CHEM' },
  { name: 'Physics', prefix: 'PHYS' },
  { name: 'Psychology', prefix: 'PSYC' },
  { name: 'History', prefix: 'HIST' },
  { name: 'Business', prefix: 'BUSN' },
  { name: 'Art', prefix: 'ARTS' },
  { name: 'Music', prefix: 'MUSC' },
  { name: 'Political Science', prefix: 'POLS' },
  { name: 'Sociology', prefix: 'SOCI' },
  { name: 'Economics', prefix: 'ECON' }
].sort((a, b) => a.name.localeCompare(b.name));

export function StudentDashboard() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuthStore();

  useEffect(() => {
    fetchCourses();
    if (user) {
      fetchEnrollments();
    }
  }, [user]);

  async function fetchCourses() {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching courses:', error);
      toast.error('Failed to load courses');
      return;
    }
    
    setCourses(data);
    setIsLoading(false);
  }

  async function fetchEnrollments() {
    if (!user) return;

    const { data, error } = await supabase
      .from('enrollments')
      .select(`
        *,
        courses (*)
      `)
      .eq('student_id', user.id)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching enrollments:', error);
      toast.error(`Failed to load your enrollments: ${error.message || error}`);
      return;
    }
    
    setEnrollments(data);
  }

  async function ensureStudentProfile() {
    if (!user) return false;

    try {
        // Step 1: Try to get existing profile first
        const { data: existingProfile, error: profileError } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('auth_user_id', user.id)
            .single();

        // If no profile exists and no error (other than not found), create one
        if (!existingProfile && (!profileError || profileError.code === 'PGRST116')) {
            const { error: insertError } = await supabase
                .from('user_profiles')
                .insert({
                    auth_user_id: user.id,
                    email: user.email,
                    name: user.name || user.email?.split('@')[0] || 'Student User',
                    role: 'student'
                });

            if (insertError) {
                console.error('Error creating profile:', insertError);
                toast.error(`Failed to create user profile: ${insertError.message}`);
                return false;
            }
        } else if (profileError && profileError.code !== 'PGRST116') {
            console.error('Error checking profile:', profileError);
            return false;
        }

        // Step 2: Check for student record
        const { data: existingStudent, error: studentError } = await supabase
            .from('students')
            .select('*')
            .eq('id', user.id)
            .single();

        // If no student exists and no error (other than not found), create one
        if (!existingStudent && (!studentError || studentError.code === 'PGRST116')) {
            const { error: insertError } = await supabase
                .from('students')
                .insert({
                    id: user.id,
                    name: user.name || user.email?.split('@')[0] || 'Student User',
                    email: user.email,
                    academic_status: 'active'
                });

            if (insertError) {
                console.error('Error creating student:', insertError);
                toast.error(`Failed to create student record: ${insertError.message}`);
                return false;
            }
        } else if (studentError && studentError.code !== 'PGRST116') {
            console.error('Error checking student:', studentError);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Unexpected error:', error);
        toast.error('An unexpected error occurred');
        return false;
    }
  }

  async function enrollInCourse(courseId: string) {
    if (!user) {
      toast.error('You must be logged in to enroll in a course');
      return;
    }

    // Ensure student profile exists
    const profileCreated = await ensureStudentProfile();
    if (!profileCreated) {
      toast.error('Could not create/verify your student profile');
      return;
    }

    // Check if course is already full
    const course = courses.find(c => c.id === courseId);
    if (course && course.current_enrollment >= course.max_capacity) {
      toast.error('This course is already full');
      return;
    }

    // First insert the enrollment
    const { error: enrollmentError } = await supabase
      .from('enrollments')
      .insert([
        { 
          course_id: courseId, 
          student_id: user.id,
          enrollment_status: 'enrolled'
        }
      ]);

    if (enrollmentError) {
      if (enrollmentError.code === '23505') {
        toast.error('You are already enrolled in this course');
      } else {
        console.error('Error enrolling in course:', enrollmentError);
        toast.error('Failed to enroll in course');
      }
      return;
    }

    // Then increment the course enrollment count
    const { error: updateError } = await supabase
      .from('courses')
      .update({ 
        current_enrollment: course ? course.current_enrollment + 1 : 1 
      })
      .eq('id', courseId);

    if (updateError) {
      console.error('Error updating course enrollment count:', updateError);
    }

    // Log the enrollment
    const { error: logError } = await supabase
        .from('logs')
        .insert([{
            action: 'student_enrolled',
            performed_by: user.id,
            details: {
                course_id: courseId,
                student_id: user.id,
                course_name: course?.name,
                student_name: user.name,
                timestamp: new Date().toISOString(),
                type: 'enrollment',
                status: 'success'
            },
            created_at: new Date().toISOString()
        }]);

    if (logError) {
        console.error('Error logging enrollment:', logError);
    }

    toast.success('Successfully enrolled in course');
    fetchCourses();
    fetchEnrollments();
  }

  async function dropCourse(courseId: string) {
    if (!user) {
        toast.error('You must be logged in to drop a course');
        return;
    }

    // Get course details before dropping
    const course = courses.find(c => c.id === courseId);

    // Delete the enrollment
    const { error: enrollmentError } = await supabase
        .from('enrollments')
        .delete()
        .eq('course_id', courseId)
        .eq('student_id', user.id);

    if (enrollmentError) {
        console.error('Error dropping course:', enrollmentError);
        toast.error('Failed to drop course');
        return;
    }

    // Update course enrollment count
    const { error: updateError } = await supabase
        .from('courses')
        .update({ 
            current_enrollment: course && course.current_enrollment > 0 
                ? course.current_enrollment - 1 
                : 0 
        })
        .eq('id', courseId);

    if (updateError) {
        console.error('Error updating course enrollment count:', updateError);
    }

    // Log the drop
    const { error: logError } = await supabase
        .from('logs')
        .insert([{
            action: 'student_dropped',
            performed_by: user.id,
            details: {
                course_id: courseId,
                student_id: user.id,
                course_name: course?.name,
                student_name: user.name,
                timestamp: new Date().toISOString(),
                type: 'drop',
                status: 'success'
            },
            created_at: new Date().toISOString()
        }]);

    if (logError) {
        console.error('Error logging course drop:', logError);
    }

    toast.success('Successfully dropped course');
    fetchCourses();
    fetchEnrollments();
  }

  async function fetchRecentActivity() {
    const { data, error } = await supabase
        .from('logs')
        .select(`
            *,
            user_profiles!performed_by(name, email)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) {
        console.error('Error fetching recent activity:', error);
        toast.error('Failed to load recent activity');
        return [];
    }

    return data;
  }

  const filteredCourses = courses.filter(course =>
    course.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (course.code && course.code.toLowerCase().includes(searchTerm.toLowerCase())) ||
    course.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
    course.instructor.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const enrolledCourseIds = enrollments.map(e => e.course_id);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            type="text"
            placeholder="Search courses..."
            className="pl-10 pr-4 py-2 w-full border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="text-sm text-gray-600">
          <span className="font-medium">My Enrollments:</span> {enrollments.length} course(s)
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-medium text-gray-900">Available Courses</h2>
            <span className="text-sm text-gray-600">{filteredCourses.length} courses</span>
          </div>
          <div className="p-6 space-y-4">
            {isLoading ? (
              <div className="text-center py-4">Loading courses...</div>
            ) : filteredCourses.length > 0 ? (
              filteredCourses.map(course => (
                <div key={course.id} className="border rounded-lg p-4 hover:bg-gray-50 transition">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium text-gray-900">{course.name}</h3>
                      <p className="text-sm text-gray-600">
                        {course.code && <span className="mr-2">{course.code}</span>}
                        <span>{course.department}</span>
                      </p>
                      <p className="text-sm text-gray-600">Instructor: {course.instructor}</p>
                      <div className="mt-1 flex items-center text-sm">
                        <span className={`inline-block h-2 w-2 rounded-full mr-2 ${
                          course.current_enrollment >= course.max_capacity 
                            ? 'bg-red-500' 
                            : 'bg-green-500'
                        }`}></span>
                        <span>
                          {course.current_enrollment >= course.max_capacity 
                            ? 'Course full' 
                            : `${course.max_capacity - course.current_enrollment} spots left`}
                          ({course.current_enrollment}/{course.max_capacity})
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        if (enrolledCourseIds.includes(course.id)) {
                          dropCourse(course.id);
                        } else {
                          enrollInCourse(course.id);
                        }
                      }}
                      disabled={!enrolledCourseIds.includes(course.id) && course.current_enrollment >= course.max_capacity}
                      className={`px-4 py-2 rounded-md text-sm font-medium ${
                        enrolledCourseIds.includes(course.id)
                            ? 'bg-red-600 text-white hover:bg-red-700'
                            : course.current_enrollment >= course.max_capacity
                                ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                                : 'bg-indigo-600 text-white hover:bg-indigo-700'
                      }`}
                    >
                      {enrolledCourseIds.includes(course.id) 
                          ? 'Drop Course' 
                          : course.current_enrollment >= course.max_capacity
                              ? 'Course Full'
                              : 'Enroll'}
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-10 text-gray-500">
                No courses available matching your search.
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">My Enrollments</h2>
          </div>
          <div className="p-6">
            {enrollments.length > 0 ? (
              <div className="space-y-4">
                {enrollments.map(enrollment => (
                  <div key={enrollment.id} className="border rounded-lg p-4 hover:bg-gray-50 transition">
                    <div className="flex justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900">{enrollment.courses?.name}</h3>
                        <p className="text-sm text-gray-600">
                          {enrollment.courses?.code && <span className="mr-2">{enrollment.courses.code}</span>}
                          <span>{enrollment.courses?.department}</span>
                        </p>
                        <div className="flex items-center mt-1 text-xs text-gray-500">
                          <Clock className="w-3 h-3 mr-1" />
                          <span>Enrolled on: {new Date(enrollment.enrollment_date).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          dropCourse(enrollment.course_id);
                        }}
                        className="px-3 py-1 border border-red-300 text-red-600 rounded-md text-sm hover:bg-red-50 transition"
                      >
                        Drop
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-gray-500">
                You haven't enrolled in any courses yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}