import React, { useState, useEffect } from 'react';
import { X, Users, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Course } from '../types';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

interface EditCourseModalProps {
  course: Course;
  onClose: () => void;
  onCourseUpdated: () => void;
}

export function EditCourseModal({ course, onClose, onCourseUpdated }: EditCourseModalProps) {
  const [courseData, setCourseData] = useState({
    title: '',
    description: '',
    max_capacity: 50,
    status: 'active',
    start_date: '',
    end_date: '',
    schedule: '',
    location: '',
    prerequisites: '',
    syllabus_url: '',
    course_code: '',
    department: '',
    credits: 3,
    ...course
  });
  const [instructors, setInstructors] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuthStore();

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchInstructors();
    }
  }, [user]);

  async function fetchInstructors() {
    const { data, error } = await supabase
      .from('instructors')
      .select('id, name, department, status')
      .order('name');

    if (error) {
      console.error('Error fetching instructors:', error);
      toast.error('Failed to load instructors');
      return;
    }

    setInstructors(data || []);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Get the instructor details for the selected ID
      let instructorDetails = null;
      if (courseData.instructor_id) {
        const { data: instructor } = await supabase
          .from('instructors')
          .select('name, department')
          .eq('id', courseData.instructor_id)
          .single();
        
        if (instructor) {
          instructorDetails = instructor;
        }
      }

      const updates = {
        name: courseData.title,
        code: courseData.course_code,
        department: courseData.department,
        max_capacity: courseData.max_capacity,
        instructor_id: courseData.instructor_id,
        instructor: instructorDetails?.name || courseData.instructor,
        status: courseData.status,
        start_date: courseData.start_date,
        end_date: courseData.end_date,
        schedule: courseData.schedule,
        location: courseData.location,
        prerequisites: courseData.prerequisites,
        syllabus_url: courseData.syllabus_url,
        credits: courseData.credits,
        updated_at: new Date().toISOString()
      };

      const { error: updateError } = await supabase
        .from('courses')
        .update(updates)
        .eq('id', courseData.id);

      if (updateError) {
        throw updateError;
      }

      // Log the update
      await supabase.from('logs').insert([{
        action: 'course_updated',
        performed_by: user?.id,
        details: {
          course_id: courseData.id,
          previous_name: course.title,
          new_name: courseData.title,
          previous_instructor: course.instructor,
          new_instructor: instructorDetails?.name || courseData.instructor,
          changes: {
            name: courseData.title !== course.title,
            code: courseData.course_code !== course.code,
            department: courseData.department !== course.department,
            instructor: courseData.instructor_id !== course.instructor_id,
            capacity: courseData.max_capacity !== course.max_capacity,
            status: courseData.status !== course.status,
            start_date: courseData.start_date !== course.start_date,
            end_date: courseData.end_date !== course.end_date,
            schedule: courseData.schedule !== course.schedule,
            location: courseData.location !== course.location,
            prerequisites: courseData.prerequisites !== course.prerequisites,
            syllabus_url: courseData.syllabus_url !== course.syllabus_url,
            credits: courseData.credits !== course.credits
          }
        }
      }]);

      toast.success('Course updated successfully');
      onCourseUpdated();
      onClose();
    } catch (err: any) {
      console.error('Error updating course:', err);
      toast.error('Failed to update course: ' + (err.message || 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setCourseData((prevCourse) => ({
      ...prevCourse,
      [name]: value
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Edit Course</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Course Code</label>
              <input
                type="text"
                name="course_code"
                value={courseData.course_code}
                onChange={handleInputChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Department</label>
              <input
                type="text"
                name="department"
                value={courseData.department}
                onChange={handleInputChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Credits</label>
              <input
                type="number"
                name="credits"
                value={courseData.credits}
                onChange={handleInputChange}
                min="0"
                max="6"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Status</label>
              <select
                name="status"
                value={courseData.status}
                onChange={handleInputChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="archived">Archived</option>
                <option value="draft">Draft</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Start Date</label>
              <input
                type="date"
                name="start_date"
                value={courseData.start_date}
                onChange={handleInputChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">End Date</label>
              <input
                type="date"
                name="end_date"
                value={courseData.end_date}
                onChange={handleInputChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Schedule</label>
              <input
                type="text"
                name="schedule"
                value={courseData.schedule}
                onChange={handleInputChange}
                placeholder="e.g., Mon/Wed 2:00 PM - 3:30 PM"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Location</label>
              <input
                type="text"
                name="location"
                value={courseData.location}
                onChange={handleInputChange}
                placeholder="e.g., Room 101, Building A"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Prerequisites</label>
              <input
                type="text"
                name="prerequisites"
                value={courseData.prerequisites}
                onChange={handleInputChange}
                placeholder="e.g., MATH101, CS200"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Syllabus URL</label>
              <input
                type="url"
                name="syllabus_url"
                value={courseData.syllabus_url}
                onChange={handleInputChange}
                placeholder="https://..."
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
          </div>

          {courseData.enrolled_count > 0 && (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 my-4">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-yellow-400 mr-2" />
                <p className="text-sm text-yellow-700">
                  This course has {courseData.enrolled_count} enrolled students. Changes may affect their enrollment.
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Updating...
                </span>
              ) : (
                'Update Course'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}