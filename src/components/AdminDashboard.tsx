import React, { useState, useEffect } from 'react';
import { Plus, Search, Download, Trash2, Edit, Eye, Clock, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Course, Log } from '../types';
import { AddCourseModal } from './AddCourseModal';
import { EditCourseModal } from './EditCourseModal';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';

export function AdminDashboard() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [recentActivity, setRecentActivity] = useState<Log[]>([]);
  const [instructors, setInstructors] = useState<Course[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuthStore();

  useEffect(() => {
    fetchData();
    setupRealtimeSubscription();
  }, []);

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('admin-dashboard')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'logs'
        },
        () => {
          fetchRecentActivity();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'courses'
        },
        () => {
          fetchCourses();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  async function fetchData() {
    setIsLoading(true);
    await Promise.all([
      fetchCourses(),
      fetchRecentActivity(),
      fetchInstructors()
    ]);
    setIsLoading(false);
  }

  async function fetchCourses() {
    setIsLoading(true);
    
    try {
      // For demo users, use localStorage to get and manage courses
      if (isDemoUser(user?.id || '')) {
        const demoCourses = getDemoCoursesFromStorage();
        setCourses(demoCourses);
        setIsLoading(false);
        return;
      }
      
      // For real users, use Supabase
      const { data, error } = await supabase
        .from('courses')
        .select(`
          *,
          instructor:instructors(id, name, department, status)
        `)
        .order('created_at', { ascending: false });
      
      setIsLoading(false);
      
      if (error) {
        console.error('Error fetching courses:', error);
        toast.error('Failed to load courses');
        return;
      }
      
      setCourses(data || []);
    } catch (err) {
      console.error('Error in fetchCourses:', err);
      setIsLoading(false);
      toast.error('Failed to load courses');
    }
  }

  async function fetchRecentActivity() {
    try {
      const { data: logsData, error: logsError } = await supabase
        .from('logs')
        .select(`
          id,
          action,
          performed_by,
          details,
          created_at,
          user:user_profiles!performed_by(name, role)
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      if (logsError) {
        console.error('Error fetching activity:', logsError);
        toast.error('Failed to load recent activity');
        return;
      }

      setRecentActivity(logsData || []);
    } catch (err) {
      console.error('Error in fetchRecentActivity:', err);
      toast.error('Failed to load recent activity');
    }
  }

  async function fetchInstructors() {
    try {
      const { data, error } = await supabase
        .from('instructors')
        .select(`
          id,
          name,
          department,
          status,
          auth_user_id
        `)
        .order('name');

      if (error) {
        console.error('Error fetching instructors:', error);
        toast.error('Failed to load instructors');
        return;
      }

      setInstructors(data || []);
    } catch (err) {
      console.error('Error in fetchInstructors:', err);
      toast.error('Failed to load instructors');
    }
  }

  async function deleteCourse(courseId: string) {
    if (!confirm('Are you sure you want to delete this course? This action cannot be undone.')) {
      return;
    }

    try {
      // For demo users, remove from localStorage
      if (isDemoUser(user?.id || '')) {
        removeCourseFromDemoStorage(courseId);
        toast.success('Course deleted successfully');
        fetchCourses();
        return;
      }
      
      // For real users, use Supabase
      const { error } = await supabase
        .from('courses')
        .delete()
        .eq('id', courseId);

      if (error) {
        console.error('Error deleting course:', error);
        toast.error('Failed to delete course: ' + error.message);
        return;
      }

      // Log the action
      await supabase
        .from('logs')
        .insert([{
          action: 'course_deleted',
          performed_by: (await supabase.auth.getUser()).data.user?.id,
          details: { course_id: courseId },
        }]);

      toast.success('Course deleted successfully');
      fetchCourses();
      fetchRecentActivity();
    } catch (err: any) {
      console.error('Unexpected error deleting course:', err);
      toast.error('Failed to delete course: ' + (err.message || 'Unknown error'));
    }
  }

  const handleEditCourse = (course: Course) => {
    setSelectedCourse(course);
    setIsEditModalOpen(true);
  };

  const filteredCourses = courses.filter(course =>
    course.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    course.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    course.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (course.instructor?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const exportToCSV = () => {
    const headers = ['Course Name', 'Code', 'Department', 'Instructor', 'Capacity', 'Enrollment', 'Created At'];
    const csvContent = [
      headers.join(','),
      ...courses.map(course => [
        course.name,
        course.code,
        course.department,
        course.instructor?.name,
        course.max_capacity,
        course.current_enrollment,
        new Date(course.created_at).toLocaleDateString()
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'courses.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getActionDescription = (log: any) => {
    const details = log.details || {};
    const userName = log.user?.name || 'Unknown User';
    const userRole = log.user?.role || 'unknown role';
    const timestamp = new Date(log.created_at).toLocaleString();
    
    let description = '';
    let icon = null;
    
    switch (log.action) {
      case 'course_created':
        description = `${userName} created course "${details.course_name || 'Unknown'}"`;
        icon = <Plus className="h-4 w-4 text-green-500" />;
        break;
      case 'course_updated':
        const changes = details.changes || {};
        const changesList = Object.entries(changes)
          .filter(([_, changed]) => changed)
          .map(([field]) => field)
          .join(', ');
        description = `${userName} updated ${changesList} for course "${details.previous_name || 'Unknown'}"`;
        icon = <Edit className="h-4 w-4 text-blue-500" />;
        break;
      case 'course_deleted':
        description = `${userName} deleted a course`;
        icon = <Trash2 className="h-4 w-4 text-red-500" />;
        break;
      case 'instructor_assigned':
        description = `${userName} assigned ${details.instructor_name || 'an instructor'} to "${details.course_name || 'a course'}"`;
        icon = <Users className="h-4 w-4 text-indigo-500" />;
        break;
      default:
        description = `${userName} (${userRole}) performed ${log.action || 'an action'}`;
        icon = <Clock className="h-4 w-4 text-gray-500" />;
    }

    return { description, icon, timestamp };
  };
  
  // Helper functions for demo users
  function isDemoUser(userId: string) {
    return userId === '11111111-2222-3333-4444-555555555555' || // admin
           userId === '12345678-1234-1234-1234-123456789012' || // student
           userId === '87654321-4321-4321-4321-210987654321';   // instructor
  }
  
  function getDemoCoursesFromStorage() {
    try {
      // Get existing courses or initialize with some demo data if empty
      let courses = JSON.parse(localStorage.getItem('demoCourses') || '[]');
      
      if (courses.length === 0) {
        // Add some demo courses for first-time demo users
        courses = [
          {
            id: 'course-1',
            name: 'Introduction to Programming',
            code: 'CS101',
            department: 'Computer Science',
            instructor: 'Demo Instructor',
            instructor_id: '87654321-4321-4321-4321-210987654321',
            max_capacity: 30,
            current_enrollment: 15,
            created_at: new Date().toISOString()
          },
          {
            id: 'course-2',
            name: 'Data Structures and Algorithms',
            code: 'CS201',
            department: 'Computer Science',
            instructor: 'Demo Instructor',
            instructor_id: '87654321-4321-4321-4321-210987654321',
            max_capacity: 25,
            current_enrollment: 18,
            created_at: new Date().toISOString()
          }
        ];
        localStorage.setItem('demoCourses', JSON.stringify(courses));
      }
      
      return courses;
    } catch (err) {
      console.error('Error getting demo courses:', err);
      return [];
    }
  }
  
  function removeCourseFromDemoStorage(courseId: string) {
    try {
      const courses = JSON.parse(localStorage.getItem('demoCourses') || '[]');
      const updatedCourses = courses.filter((c: any) => c.id !== courseId);
      localStorage.setItem('demoCourses', JSON.stringify(updatedCourses));
      
      // Also add to demo logs
      addDemoLog({
        id: 'log-' + new Date().getTime(),
        action: 'course_deleted',
        performed_by: user?.id || '',
        details: { course_id: courseId },
        created_at: new Date().toISOString(),
        user_profiles: { name: user?.name || 'Demo Admin', role: 'admin' }
      });
    } catch (err) {
      console.error('Error removing course from localStorage:', err);
    }
  }
  
  function generateDemoLogs() {
    const storedLogs = JSON.parse(localStorage.getItem('demoLogs') || '[]');
    
    // If we have stored logs, return those
    if (storedLogs.length > 0) {
      return storedLogs;
    }
    
    // Otherwise generate some fake logs
    const demoLogs = [
      {
        id: 'log-1',
        action: 'course_created',
        performed_by: '11111111-2222-3333-4444-555555555555',
        details: { course_name: 'Introduction to Programming', course_id: 'course-1' },
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
        user_profiles: { name: 'Demo Admin', role: 'admin' }
      },
      {
        id: 'log-2',
        action: 'course_created',
        performed_by: '87654321-4321-4321-4321-210987654321',
        details: { course_name: 'Data Structures and Algorithms', course_id: 'course-2' },
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(), // 12 hours ago
        user_profiles: { name: 'Demo Instructor', role: 'instructor' }
      }
    ];
    
    // Save to localStorage
    localStorage.setItem('demoLogs', JSON.stringify(demoLogs));
    
    return demoLogs;
  }
  
  function addDemoLog(log: any) {
    try {
      const logs = JSON.parse(localStorage.getItem('demoLogs') || '[]');
      logs.unshift(log); // Add to beginning
      localStorage.setItem('demoLogs', JSON.stringify(logs.slice(0, 20))); // Keep only 20 most recent
    } catch (err) {
      console.error('Error adding demo log:', err);
    }
  }

  async function updateCourseInstructor(courseId: string, newInstructorId: string) {
    const { error } = await supabase
      .from('courses')
      .update({ instructor_id: newInstructorId })
      .eq('id', courseId);

    if (error) {
      console.error('Error updating course:', error);
      toast.error('Failed to update course instructor');
      return;
    }

    toast.success('Course instructor updated successfully');
    fetchCourses();
    setSelectedCourse(null);
  }

  return (
    <div className="p-6 space-y-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <div className="flex items-center gap-4">
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
          <button
            onClick={exportToCSV}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
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

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Course Management Section */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Course Management</h2>
            <p className="mt-1 text-sm text-gray-500">Manage all courses and their instructors</p>
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Instructor</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Enrollment</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredCourses.map(course => (
                    <tr key={course.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{course.name}</div>
                        <div className="text-xs text-gray-500">Created {new Date(course.created_at).toLocaleDateString()}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 text-xs font-medium bg-gray-100 rounded-full">{course.code}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{course.department}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {course.instructor?.name || 'No instructor'}
                          {course.instructor?.status === 'pending' && (
                            <span className="ml-2 px-2 py-1 text-xs font-medium text-yellow-800 bg-yellow-100 rounded-full">
                              Pending
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="text-sm text-gray-900">
                            {course.current_enrollment} / {course.max_capacity}
                          </div>
                          <div className="ml-2 w-16 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-indigo-600 rounded-full h-2"
                              style={{
                                width: `${(course.current_enrollment / course.max_capacity) * 100}%`
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex space-x-3">
                          <button
                            onClick={() => handleEditCourse(course)}
                            className="text-indigo-600 hover:text-indigo-900"
                            title="Edit course"
                          >
                            <Edit className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => deleteCourse(course.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete course"
                          >
                            <Trash2 className="h-5 w-5" />
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
            </div>
          )}
        </div>

        {/* Recent Activity Section */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
                <p className="mt-1 text-sm text-gray-500">Latest actions in the system</p>
              </div>
              <button
                onClick={() => fetchRecentActivity()}
                className="text-sm text-indigo-600 hover:text-indigo-900 flex items-center"
              >
                <Clock className="h-4 w-4 mr-1" />
                Refresh
              </button>
            </div>
          </div>
          <div className="p-6 space-y-4 max-h-[600px] overflow-y-auto">
            {isLoading ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto"></div>
                <p className="mt-2 text-sm text-gray-500">Loading activity...</p>
              </div>
            ) : recentActivity.length > 0 ? (
              recentActivity.map((log) => {
                const { description, icon, timestamp } = getActionDescription(log);
                return (
                  <div key={log.id} className="border rounded-lg p-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 mt-1">{icon}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{description}</p>
                        <div className="flex items-center mt-1 space-x-2">
                          <span className="text-xs text-gray-500">{timestamp}</span>
                          <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                            {log.user?.role || 'unknown role'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8">
                <Clock className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500">No recent activity</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {isAddModalOpen && (
        <AddCourseModal
          onClose={() => setIsAddModalOpen(false)}
          onCourseAdded={() => {
            fetchCourses();
            fetchRecentActivity();
          }}
        />
      )}

      {isEditModalOpen && selectedCourse && (
        <EditCourseModal
          course={selectedCourse}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedCourse(null);
          }}
          onCourseUpdated={() => {
            fetchCourses();
            fetchRecentActivity();
          }}
        />
      )}
    </div>
  );
}