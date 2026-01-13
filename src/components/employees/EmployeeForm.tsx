'use client';

import { useState } from 'react';
import { IEmployee, EmployeeType, EmployeeRole } from '@/lib/models/Employee';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';

interface EmployeeFormProps {
  employee?: IEmployee;
  onSubmit: (data: Partial<IEmployee>) => void;
  onCancel: () => void;
}

export default function EmployeeForm({ employee, onSubmit, onCancel }: EmployeeFormProps) {
  const [name, setName] = useState(employee?.name || '');
  const [role, setRole] = useState<EmployeeRole>(employee?.role || 'User');
  const [jobTitle, setJobTitle] = useState(employee?.jobTitle || '');
  const [weeklyHours, setWeeklyHours] = useState(employee?.weeklyHours?.toString() || '40');
  const [employeeType, setEmployeeType] = useState<EmployeeType>(employee?.employeeType || 'full-time');
  const [email, setEmail] = useState(employee?.email || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const parsedWeeklyHours = parseFloat(weeklyHours);
    if (isNaN(parsedWeeklyHours)) {
      alert('Please enter a valid number for weekly hours');
      return;
    }

    onSubmit({
      name,
      role,
      jobTitle: jobTitle || undefined,
      weeklyHours: parsedWeeklyHours,
      employeeType,
      email: email || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <Select
        label="Role"
        value={role}
        onChange={(e) => setRole(e.target.value as EmployeeRole)}
        options={[
          { value: 'Administrator', label: 'Administrator (can edit employees)' },
          { value: 'User', label: 'User (cannot edit employees)' },
        ]}
        required
      />
      <Input
        label="Job Title (optional)"
        value={jobTitle}
        onChange={(e) => setJobTitle(e.target.value)}
        placeholder="e.g., Senior Developer, Product Manager, Designer"
      />
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Weekly Hours"
          type="number"
          min="0"
          max="168"
          step="0.5"
          value={weeklyHours}
          onChange={(e) => setWeeklyHours(e.target.value)}
          required
        />
        <Select
          label="Employee Type"
          value={employeeType}
          onChange={(e) => setEmployeeType(e.target.value as EmployeeType)}
          options={[
            { value: 'full-time', label: 'Full-Time' },
            { value: 'part-time', label: 'Part-Time' },
            { value: 'contractor', label: 'Contractor' },
          ]}
          required
        />
      </div>
      <Input
        label="Email (for invitation - optional)"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="employee@example.com"
      />
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          {employee ? 'Update' : 'Create'} Employee
        </Button>
      </div>
    </form>
  );
}
