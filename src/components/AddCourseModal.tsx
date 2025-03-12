import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';
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

interface AddCourseModalProps {
  onClose: () => void;
  onCourseAdded?: () => void;
}

export function AddCourseModal({ onClose, onCourseAdded }: AddCourseModalProps) {
  const [name, setName] = useState('');
  const [department, setDepartment] = useState(DEPARTMENTS[0].name);
  const [courseNumber, setCourseNumber] = useState('');
  const [maxCapacity, setMaxCapacity] = useState(50);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuthStore();

  const selectedDepartmentPrefix = DEPARTMENTS.find(d => d.name === department)?.prefix || '';

  const handleCourseNumberChange = (value: string) => {
    // Remove any non-digit characters
    const cleanValue = value.replace(/\D/g, '');
    
    // Don't update if empty
    if (!cleanValue) {
      setCourseNumber('');
      return;
    }

    // Parse the number
    const num = parseInt(cleanValue);
    
    // Only update if within range
    if (num >= 1000 && num <= 7000) {
      setCourseNumber(cleanValue);
    } else if (num < 1000) {
      // Allow typing numbers less than 1000 as they might still be typing
      setCourseNumber(cleanValue);
    }
  };

  const courseCode = courseNumber ? `${selectedDepartmentPrefix} ${courseNumber}` : '';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    const num = parseInt(courseNumber);
    if (!courseNumber || num < 1000 || num > 7000) {
      toast.error('Please enter a valid course number between 1000 and 7000');
      return;
    }

    setIsLoading(true);

    try {
      // Step 1: Get or create instructor profile
      let instructorId: string | null = null;
      
      // First, try to get existing profile
      const { data: existingProfiles, error: fetchError } = await supabase
        .from('instructors')
        .select('id')
        .eq('auth_user_id', user.id);

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw new Error(`Failed to fetch instructor profile: ${fetchError.message}`);
      }

      if (existingProfiles && existingProfiles.length > 0) {
        instructorId = existingProfiles[0].id;
      } else {
        // Create new profile if none exists
        const { data: newProfile, error: profileError } = await supabase
          .from('instructors')
          .insert({
            auth_user_id: user.id,
            name: user.name || user.email?.split('@')[0] || 'Instructor',
            department: department,
            status: 'active'
          })
          .select('id')
          .single();

        if (profileError) {
          console.error('Profile creation error:', profileError);
          throw new Error(`Failed to create instructor profile: ${profileError.message}`);
        }

        if (!newProfile) {
          throw new Error('Failed to create instructor profile: No profile returned');
        }

        instructorId = newProfile.id;
      }

      if (!instructorId) {
        throw new Error('Could not get or create instructor profile');
      }

      // Step 2: Create the course
      const { error: courseError } = await supabase
        .from('courses')
        .insert({
          name,
          code: courseCode,
          department,
          instructor_id: instructorId,
          instructor: user.name || user.email?.split('@')[0] || 'Instructor',
          max_capacity: maxCapacity,
          current_enrollment: 0
        });

      if (courseError) {
        throw new Error(`Failed to create course: ${courseError.message}`);
      }

      toast.success('Course created successfully');
      
      // Add a small delay before closing the modal and refreshing
      setTimeout(() => {
        onCourseAdded?.();
        onClose();
      }, 500);

    } catch (error) {
      console.error('Error:', error);
      toast.error(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  }

  // Handle modal close with cleanup
  const handleClose = () => {
    setIsLoading(false);
    setName('');
    setCourseNumber('');
    setMaxCapacity(50);
    onClose();
  };

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isLoading]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Add New Course</h2>
          <button 
            onClick={handleClose}
            disabled={isLoading}
            className="text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Department Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Department
            </label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full border rounded-md py-2 px-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            >
              {DEPARTMENTS.map((dept) => (
                <option key={dept.prefix} value={dept.name}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          {/* Course Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Course Number (1000-7000)
            </label>
            <div className="flex items-center space-x-2">
              <span className="text-gray-500 bg-gray-100 px-2 py-2 rounded-md">{selectedDepartmentPrefix}</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={courseNumber}
                onChange={(e) => handleCourseNumberChange(e.target.value)}
                className="flex-1 border rounded-md py-2 px-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
                placeholder="Enter course number"
                maxLength={4}
              />
            </div>
            {courseNumber && parseInt(courseNumber) < 1000 && (
              <p className="mt-1 text-sm text-gray-500">
                Course number must be at least 1000
              </p>
            )}
          </div>

          {/* Course Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Course Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border rounded-md py-2 px-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
              placeholder="Enter course name"
            />
          </div>

          {/* Maximum Capacity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Maximum Capacity
            </label>
            <input
              type="number"
              value={maxCapacity}
              onChange={(e) => setMaxCapacity(parseInt(e.target.value) || 50)}
              className="w-full border rounded-md py-2 px-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
              min="1"
            />
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="px-4 py-2 border rounded-md text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {isLoading ? 'Creating...' : 'Create Course'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}