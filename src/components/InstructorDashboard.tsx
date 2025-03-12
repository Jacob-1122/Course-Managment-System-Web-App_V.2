import React, { useState, useEffect } from 'react';
import { Plus, Search, Users, BookOpen, GraduationCap, BarChart2, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Course } from '../types';
import { AddCourseModal } from './AddCourseModal';
import { EditCourseModal } from './EditCourseModal';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';

export function InstructorDashboard() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalStudents: 0,
    averageEnrollment: 0,
    totalCourses: 0,
    pendingRequests: 0
  });
  const { user } = useAuthStore();

  useEffect(() => {
    fetchData();
    setupRealtimeSubscription();
  }, []);

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('instructor-dashboard')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'courses'
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  async function fetchData() {
    setIsLoading(true);
    try {
      await Promise.all([
        fetchCourses(),
        fetchStats()
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchCourses() {
    try {
      console.log('Fetching instructor profile...');
      // First, get the instructor profile for the current user
      const { data: instructorProfile, error: profileError } = await supabase
        .from('instructors')
        .select('id, name, department, auth_user_id')
        .eq('auth_user_id', user?.id)
        .single();

      if (profileError) {
        console.error('Error fetching instructor profile:', profileError);
        if (profileError.code === '42P17') {
          console.log('Policy error detected, checking user role...');
          const { data: userProfile } = await supabase
            .from('profiles')
            .select('role')
            .eq('auth_user_id', user?.id)
            .single();
          
          if (!userProfile || userProfile.role !== 'instructor') {
            toast.error('You do not have instructor privileges');
            return;
          }
        }
        toast.error('Failed to load instructor profile');
        return;
      }

      if (!instructorProfile) {
        console.log('No instructor profile found, attempting to create one...');
        // Attempt to create instructor profile
        const { data: newInstructor, error: createError } = await supabase
          .from('instructors')
          .insert([
            {
              auth_user_id: user?.id,
              name: user?.email?.split('@')[0] || 'New Instructor',
              department: 'Pending Assignment'
            }
          ])
          .select()
          .single();

        if (createError) {
          console.error('Error creating instructor profile:', createError);
          toast.error('Failed to create instructor profile');
          return;
        }

        if (newInstructor) {
          console.log('Created new instructor profile:', newInstructor);
          toast.success('Instructor profile created');
          instructorProfile = newInstructor;
        }
      }

      console.log('Fetching courses for instructor:', instructorProfile.id);
      // Then fetch the courses for this instructor with enrollment counts
      const { data: coursesData, error: coursesError } = await supabase
        .from('courses')
        .select(`
          *,
          enrollments:course_enrollments!left(
            id,
            status,
            student:profiles(
              id,
              name,
              email
            )
          ),
          active_enrollments:course_enrollments!inner(id)
        `)
        .eq('instructor_id', instructorProfile.id)
        .eq('course_enrollments.status', 'active')
        .order('created_at', { ascending: false });

      if (coursesError) {
        console.error('Error fetching courses:', coursesError);
        toast.error('Failed to load courses');
        return;
      }

      console.log('Courses fetched successfully:', coursesData?.length || 0, 'courses found');
      // Transform the data to include enrollment counts
      const transformedCourses = coursesData?.map(course => ({
        ...course,
        current_enrollment: course.active_enrollments?.length || 0,
        pending_enrollments: course.enrollments?.filter(e => e.status === 'pending').length || 0,
        total_enrollments: course.enrollments?.length || 0
      })) || [];

      setCourses(transformedCourses);
    } catch (err) {
      console.error('Error in fetchCourses:', err);
      toast.error('Failed to load courses');
    }
  }

  async function fetchStats() {
    try {
      // Get instructor profile
      const { data: instructorProfile } = await supabase
        .from('instructors')
        .select('*')
        .eq('auth_user_id', user?.id)
        .single();

      if (!instructorProfile) {
        console.error('No instructor profile found');
        return;
      }

      // Get all courses with enrollment counts
      const { data: coursesData, error: coursesError } = await supabase
        .from('courses')
        .select(`
          id,
          course_enrollments!inner (
            id,
            status,
            student:profiles(id, name)
          )
        `)
        .eq('instructor_id', instructorProfile.id);

      if (coursesError) {
        console.error('Error fetching course stats:', coursesError);
        return;
      }

      if (coursesData) {
        const totalCourses = courses.length;
        const totalStudents = coursesData.reduce((sum, course) => 
          sum + (course.course_enrollments?.filter(e => e.status === 'active').length || 0), 0
        );
        const averageEnrollment = totalCourses > 0 ? Math.round((totalStudents / totalCourses) * 10) / 10 : 0;

        // Get pending enrollment requests
        const { count } = await supabase
          .from('course_enrollments')
          .select('*', { count: 'exact' })
          .eq('status', 'pending')
          .in('course_id', courses.map(c => c.id));

        setStats({
          totalStudents,
          averageEnrollment,
          totalCourses,
          pendingRequests: count || 0
        });
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
      toast.error('Failed to load statistics');
    }
  }

  const exportEnrollmentData = async () => {
    try {
      const courseData = courses.map(course => {
        const students = course.enrollments?.map(e => e.student) || [];
        return {
          courseName: course.name,
          courseCode: course.code,
          totalEnrolled: students.length,
          students: students.map(s => `${s.name} (${s.email})`).join('; ')
        };
      });

      const csvContent = [
        ['Course Name', 'Course Code', 'Total Enrolled', 'Students'],
        ...courseData.map(c => [c.courseName, c.courseCode, c.totalEnrolled, c.students])
      ].map(row => row.join(',')).join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'course-enrollments.csv';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting data:', err);
      toast.error('Failed to export enrollment data');
    }
  };

  const filteredCourses = courses.filter(course =>
    course.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    course.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    course.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-8">
      {/* Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <BookOpen className="h-10 w-10 text-indigo-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Courses</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalCourses}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <Users className="h-10 w-10 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Students</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalStudents}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <BarChart2 className="h-10 w-10 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Avg. Enrollment</p>
              <p className="text-2xl font-semibold text-gray-900">
                {stats.averageEnrollment.toFixed(1)}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <GraduationCap className="h-10 w-10 text-yellow-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Pending Requests</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.pendingRequests}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            type="text"
            placeholder="Search courses..."
            className="pl-10 pr-4 py-2 w-full border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-4">
          <button
            onClick={exportEnrollmentData}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <Download className="h-4 w-4 mr-2" />
            Export Enrollments
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Course
          </button>
        </div>
      </div>

      {/* Courses List */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Your Courses</h2>
            <p className="mt-1 text-sm text-gray-500">Manage your courses and view enrollments</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => fetchData()}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full"
              title="Refresh data"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
        
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto"></div>
            <p className="mt-4 text-gray-500">Loading courses...</p>
          </div>
        ) : filteredCourses.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Course Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Enrollment
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCourses.map(course => (
                  <tr key={course.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{course.name}</div>
                      <div className="text-xs text-gray-500">
                        {course.code} • {course.department}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="text-sm text-gray-900">
                          {course.current_enrollment} / {course.max_capacity}
                        </div>
                        <div className="ml-2 w-24 bg-gray-200 rounded-full h-2">
                          <div
                            className={`rounded-full h-2 ${
                              (course.current_enrollment / course.max_capacity) > 0.9 
                                ? 'bg-red-600' 
                                : (course.current_enrollment / course.max_capacity) > 0.7 
                                  ? 'bg-yellow-600' 
                                  : 'bg-green-600'
                            }`}
                            style={{
                              width: `${Math.min((course.current_enrollment / course.max_capacity) * 100, 100)}%`
                            }}
                          />
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                        <span>{course.current_enrollment} active</span>
                        {course.pending_enrollments > 0 && (
                          <span className="text-yellow-600">
                            • {course.pending_enrollments} pending
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        course.status === 'active' ? 'bg-green-100 text-green-800' :
                        course.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {course.status || 'active'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedCourse(course);
                            setIsEditModalOpen(true);
                          }}
                          className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                        >
                          Edit Course
                        </button>
                        <button
                          onClick={() => window.location.href = `/course/${course.id}/students`}
                          className="text-gray-600 hover:text-gray-900 text-sm font-medium"
                        >
                          View Students
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-8 text-center">
            <Users className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-4 text-gray-500">No courses found matching your search.</p>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Course
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      {isAddModalOpen && (
        <AddCourseModal
          onClose={() => setIsAddModalOpen(false)}
          onCourseAdded={fetchData}
        />
      )}

      {isEditModalOpen && selectedCourse && (
        <EditCourseModal
          course={selectedCourse}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedCourse(null);
          }}
          onCourseUpdated={fetchData}
        />
      )}
    </div>
  );
}