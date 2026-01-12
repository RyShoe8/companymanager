'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { IEmployee } from '@/lib/models/Employee';
import EmployeeForm from '@/components/employees/EmployeeForm';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

export default function EmployeesPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<IEmployee[]>([]);
  const [currentUserEmployee, setCurrentUserEmployee] = useState<IEmployee | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<IEmployee | undefined>();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/employees');

      if (response.status === 401) {
        router.push('/login');
        return;
      }

      const data = await response.json();
      setEmployees(data);
      
      // Find current user's employee record to check permissions
      try {
        const userResponse = await fetch('/api/auth/me');
        if (userResponse.ok) {
          const userData = await userResponse.json();
          const currentEmployee = data.find((emp: IEmployee) => emp.userId?.toString() === userData.id);
          setCurrentUserEmployee(currentEmployee || null);
        }
      } catch (error) {
        console.error('Error loading current user:', error);
      }
    } catch (error) {
      console.error('Error loading employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEmployee = () => {
    setEditingEmployee(undefined);
    setShowEmployeeForm(true);
  };

  const handleEditEmployee = (employee: IEmployee) => {
    setEditingEmployee(employee);
    setShowEmployeeForm(true);
  };

  const handleDeleteEmployee = async (id: string) => {
    if (!confirm('Are you sure you want to delete this employee?')) return;

    try {
      const response = await fetch(`/api/employees/${id}`, { method: 'DELETE' });
      if (response.ok) {
        loadData();
      }
    } catch (error) {
      console.error('Error deleting employee:', error);
    }
  };

  const handleSubmitEmployee = async (data: Partial<IEmployee>) => {
    try {
      const url = editingEmployee ? `/api/employees/${editingEmployee._id}` : '/api/employees';
      const method = editingEmployee ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        setShowEmployeeForm(false);
        setEditingEmployee(undefined);
        loadData();
      }
    } catch (error) {
      console.error('Error saving employee:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="w-full mx-auto px-[100px] max-md:px-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Employees</h1>
          {currentUserEmployee?.role === 'Administrator' && (
            <Button onClick={handleCreateEmployee}>+ New Employee</Button>
          )}
        </div>

        {employees.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <p className="text-gray-500 dark:text-gray-400 mb-4">No employees yet. Create your first employee!</p>
            <Button onClick={handleCreateEmployee}>Create Employee</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {employees.map((employee) => (
              <Card key={employee._id.toString()} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{employee.name}</h3>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-1 rounded ${
                        employee.role === 'Administrator' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                        'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                      }`}>
                        {employee.role}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded ${
                        employee.employeeType === 'full-time' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                        employee.employeeType === 'part-time' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                        'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                      }`}>
                        {employee.employeeType === 'full-time' ? 'Full-Time' :
                         employee.employeeType === 'part-time' ? 'Part-Time' : 'Contractor'}
                      </span>
                    </div>
                    {employee.jobTitle && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{employee.jobTitle}</p>
                    )}
                    <p className="text-sm text-gray-500 dark:text-gray-500">
                      {employee.weeklyHours} hours/week
                    </p>
                    {employee.email && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{employee.email}</p>
                    )}
                  </div>
                  {currentUserEmployee?.role === 'Administrator' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditEmployee(employee)}
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteEmployee(employee._id.toString())}
                        className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

        <Modal
          isOpen={showEmployeeForm}
          onClose={() => {
            setShowEmployeeForm(false);
            setEditingEmployee(undefined);
          }}
          title={editingEmployee ? 'Edit Employee' : 'New Employee'}
        >
          <EmployeeForm
            employee={editingEmployee}
            onSubmit={handleSubmitEmployee}
            onCancel={() => {
              setShowEmployeeForm(false);
              setEditingEmployee(undefined);
            }}
          />
        </Modal>
      </div>
    </div>
  );
}
