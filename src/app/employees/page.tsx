'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { IEmployee } from '@/lib/models/Employee';
import EmployeeForm from '@/components/employees/EmployeeForm';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import type { EmployeeLimitInfo, PublicPricingPlan } from 'billing-engine/client';
import { seatUsageLine } from '@/lib/billing/seatDisplay';

type BillingSeatPayload = {
  seatLimits?: EmployeeLimitInfo | null;
  currentPlan?: PublicPricingPlan | null;
  viewer?: { role?: string };
  error?: string;
};

export default function EmployeesPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<IEmployee[]>([]);
  const [currentUserEmployee, setCurrentUserEmployee] = useState<IEmployee | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<IEmployee | undefined>();
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [isOrgOwner, setIsOrgOwner] = useState(false);
  const [seatLimits, setSeatLimits] = useState<EmployeeLimitInfo | null>(null);
  const [currentPlan, setCurrentPlan] = useState<PublicPricingPlan | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [response, billingRes] = await Promise.all([
        fetch('/api/employees'),
        fetch('/api/dashboard/billing'),
      ]);

      if (response.status === 401) {
        router.push('/login');
        return;
      }

      const data = await response.json();
      setEmployees(data);

      if (billingRes.ok) {
        const billingData = (await billingRes.json()) as BillingSeatPayload;
        setSeatLimits(billingData.seatLimits ?? null);
        setCurrentPlan(billingData.currentPlan ?? null);
      } else {
        setSeatLimits(null);
        setCurrentPlan(null);
      }

      try {
        const userResponse = await fetch('/api/auth/me');
        if (userResponse.ok) {
          const userData = await userResponse.json();
          if (userData && userData.id) {
            setIsOrgOwner(!!userData.isOrgOwner);
            const currentEmployee = data.find((emp: IEmployee) => emp.userId?.toString() === userData.id);
            setCurrentUserEmployee(currentEmployee || null);
          }
        }
      } catch {
        // Error loading current user
      }
    } catch {
      // Error loading employees
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
    if (!confirm('Are you sure you want to delete this team member?')) return;

    try {
      const response = await fetch(`/api/employees/${id}`, { method: 'DELETE' });
      if (response.ok) {
        loadData();
      }
    } catch (error) {
      // Error deleting employee
    }
  };

  const handleResendInvite = async (employeeId: string) => {
    setResendingId(employeeId);
    try {
      const response = await fetch(`/api/employees/${employeeId}/resend-invite`, {
        method: 'POST',
      });
      const result = await response.json();
      if (!response.ok) {
        alert(`Error: ${result.error || 'Failed to resend invitation'}`);
        return;
      }
      if (result.emailSent) {
        alert('Invitation email sent successfully.');
      } else {
        alert(
          `Could not send invitation email${result.emailError ? `: ${result.emailError}` : '.'}`
        );
      }
    } catch {
      alert('Failed to resend invitation. Please try again.');
    } finally {
      setResendingId(null);
    }
  };

  const handleSubmitEmployee = async (data: Partial<IEmployee>) => {
    try {
      const url = editingEmployee ? `/api/employees/${editingEmployee._id}` : '/api/employees';
      const method = editingEmployee ? 'PUT' : 'POST';

      // Submitting employee data

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        alert(`Error: ${errorData.error || 'Failed to save team member'}`);
        return;
      }

      const result = await response.json();
      if (result.emailSent === false) {
        alert(
          `Team member saved, but the invite email could not be sent${result.emailError ? `: ${result.emailError}` : '.'} Use Resend invite to try again.`
        );
      }

      setShowEmployeeForm(false);
      setEditingEmployee(undefined);
      loadData();
    } catch (error) {
      // Error saving employee
      alert('Failed to save team member. Please check the console for details.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-text-secondary">Loading...</div>
      </div>
    );
  }

  const usageLine = seatUsageLine(seatLimits, currentPlan);
  const atSeatLimit = seatLimits !== null && !seatLimits.canAddMore;

  return (
    <div className="min-h-screen bg-background px-4 sm:px-6 lg:px-[100px] py-8">
      <div className="w-full mx-auto max-w-7xl">
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <h1 className="text-3xl font-bold text-text-primary">Team</h1>
          <div className="flex items-center gap-2">
            {isOrgOwner && (
              <Button variant="secondary" onClick={() => router.push('/billing')}>
                Billing
              </Button>
            )}
            {currentUserEmployee?.role === 'Administrator' && (
              <Button onClick={handleCreateEmployee}>+ New Team Member</Button>
            )}
          </div>
        </div>

        {usageLine ? (
          <Card className="mb-6 p-4 border border-border">
            <p className="text-sm text-text-primary">{usageLine}</p>
            {atSeatLimit ? (
              <p className="text-sm text-warning mt-2">
                {isOrgOwner ? (
                  <>
                    You&apos;ve reached your seat limit.{' '}
                    <Link href="/billing" className="text-primary underline hover:text-primary-hover">
                      Upgrade on billing
                    </Link>{' '}
                    to add more team members.
                  </>
                ) : (
                  "You've reached your seat limit. Contact your organization owner to upgrade billing."
                )}
              </p>
            ) : null}
          </Card>
        ) : null}

        {employees.length === 0 ? (
          <div className="text-center py-12 bg-background-card rounded-lg border border-border">
            <p className="text-text-secondary mb-4">No team members yet. Create your first team member!</p>
            <Button onClick={handleCreateEmployee}>Create Team Member</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {employees.map((employee) => (
              <Card key={employee._id.toString()} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-text-primary mb-1">{employee.name}</h3>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-xs px-2 py-1 rounded font-medium ${
                        employee.role === 'Administrator'
                          ? 'bg-primary-light text-primary-dark'
                          : 'bg-muted text-text-secondary'
                      }`}>
                        {employee.role}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded font-medium ${
                        employee.employeeType === 'full-time'
                          ? 'bg-primary-light/80 text-primary-dark'
                          : employee.employeeType === 'part-time'
                            ? 'bg-muted text-text-primary'
                            : 'bg-muted text-text-secondary'
                      }`}>
                        {employee.employeeType === 'full-time' ? 'Full-Time' :
                         employee.employeeType === 'part-time' ? 'Part-Time' : 'Contractor'}
                      </span>
                      {employee.email && !employee.userId && (
                        <span className="text-xs px-2 py-1 rounded bg-warning-light text-warning-dark font-medium">
                          Pending invite
                        </span>
                      )}
                    </div>
                    {employee.jobTitle && (
                      <p className="text-sm text-text-secondary mb-1">{employee.jobTitle}</p>
                    )}
                    <p className="text-sm text-text-secondary">
                      {employee.weeklyHours} hours/week
                    </p>
                    {employee.email && (
                      <p className="text-xs text-text-secondary mt-1">{employee.email}</p>
                    )}
                    {employee.email && !employee.userId && currentUserEmployee?.role === 'Administrator' && (
                      <button
                        type="button"
                        onClick={() => handleResendInvite(employee._id.toString())}
                        disabled={resendingId === employee._id.toString()}
                        className="mt-2 text-xs text-primary hover:text-primary-hover disabled:opacity-50"
                      >
                        {resendingId === employee._id.toString() ? 'Sending…' : 'Resend invite'}
                      </button>
                    )}
                  </div>
                  {currentUserEmployee?.role === 'Administrator' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditEmployee(employee)}
                        className="text-primary hover:text-primary-hover"
                        aria-label="Edit team member"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteEmployee(employee._id.toString())}
                        className="text-error hover:text-error-dark"
                        aria-label="Delete team member"
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
          title={editingEmployee ? 'Edit Team Member' : 'New Team Member'}
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
