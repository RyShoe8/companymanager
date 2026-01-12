'use client';

import { IEmployee } from '@/lib/models/Employee';
import { IProject } from '@/lib/models/Project';
import { TimeframeType, getTimeframeRange } from '@/lib/utils/dateUtils';
import Card from '@/components/ui/Card';

interface EmployeeSidebarProps {
  employees: IEmployee[];
  projects: IProject[];
  timeframe: TimeframeType;
  currentDate: Date;
}

export default function EmployeeSidebar({ employees, projects, timeframe, currentDate }: EmployeeSidebarProps) {
  const range = getTimeframeRange(timeframe, currentDate);
  const startDate = new Date(range.start);
  const endDate = new Date(range.end);

  // Calculate total available hours based on timeframe
  const totalAvailableHours = (employee: IEmployee) => {
    if (timeframe === 'today') {
      // Today is 1 day = weeklyHours / 7
      return Math.round((employee.weeklyHours / 7) * 10) / 10;
    }
    if (timeframe === 'weekly') {
      // Weekly is exactly 1 week
      return employee.weeklyHours;
    }
    
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const weeks = days / 7;
    const hours = employee.weeklyHours * weeks;
    return Math.round(hours * 10) / 10; // Round to 1 decimal
  };

  const getProjectsForEmployee = (employeeName: string) => {
    return projects.filter((project) => {
      // Check if project is assigned to this employee
      if (project.assignedTo === employeeName) return true;
      
      // Check if any stage is assigned to this employee
      if (project.stages && project.stages.some(stage => stage.assignedTo === employeeName)) {
        return true;
      }
      
      return false;
    });
  };

  const getCommittedHours = (employee: IEmployee) => {
    const employeeProjects = getProjectsForEmployee(employee.name);
    let totalHours = 0;

    employeeProjects.forEach((project) => {
      // Check if whole project is assigned
      if (project.assignedTo === employee.name && project.estimatedHours) {
        totalHours += project.estimatedHours;
      }
      
      // Check stages assigned to this employee
      if (project.stages) {
        project.stages.forEach((stage) => {
          if (stage.assignedTo === employee.name && stage.estimatedHours) {
            totalHours += stage.estimatedHours;
          }
        });
      }
    });

    return totalHours;
  };

  const getAvailableHours = (employee: IEmployee) => {
    const available = totalAvailableHours(employee);
    const committed = getCommittedHours(employee);
    return Math.round(Math.max(0, available - committed) * 10) / 10; // Round to 1 decimal
  };

  if (employees.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <p className="mb-2">No employees added yet</p>
        <p className="text-sm">Add employees to track their workload</p>
      </div>
    );
  }

  // Calculate team totals
  const teamTotals = employees.reduce((totals, employee) => {
    const employeeProjects = getProjectsForEmployee(employee.name);
    let committedHours = 0;

    employeeProjects.forEach((project) => {
      if (project.assignedTo === employee.name && project.estimatedHours) {
        committedHours += project.estimatedHours;
      }
      if (project.stages) {
        project.stages.forEach((stage) => {
          if (stage.assignedTo === employee.name && stage.estimatedHours) {
            committedHours += stage.estimatedHours;
          }
        });
      }
    });

    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    let availableHours;
    if (timeframe === 'today') {
      availableHours = employee.weeklyHours / 7;
    } else if (timeframe === 'weekly') {
      availableHours = employee.weeklyHours;
    } else {
      const weeks = days / 7;
      availableHours = employee.weeklyHours * weeks;
    }

    totals.totalAvailable += availableHours;
    totals.totalCommitted += committedHours;
    return totals;
  }, { totalAvailable: 0, totalCommitted: 0 });

  const teamAvailable = Math.round(teamTotals.totalAvailable * 10) / 10;
  const teamCommitted = Math.round(teamTotals.totalCommitted * 10) / 10;
  const teamRemaining = Math.round((teamAvailable - teamCommitted) * 10) / 10;

  return (
    <div className="space-y-4">
      <div className="mb-3">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Team Capacity</h3>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-600 dark:text-gray-400">Available:</span>
            <span className="font-medium text-gray-900 dark:text-white">{teamAvailable}h</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-600 dark:text-gray-400">Committed:</span>
            <span className="font-medium text-orange-600 dark:text-orange-400">{teamCommitted}h</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-600 dark:text-gray-400">Remaining:</span>
            <span className={`font-medium ${teamRemaining > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {teamRemaining}h
            </span>
          </div>
        </div>
      </div>
      {employees.map((employee) => {
        const employeeProjects = getProjectsForEmployee(employee.name);
        const committedHours = getCommittedHours(employee);
        const availableHours = getAvailableHours(employee);
        const totalHours = totalAvailableHours(employee);
        const utilizationPercent = totalHours > 0 ? Math.round((committedHours / totalHours) * 100) : 0;

        return (
          <Card key={employee._id.toString()} className="p-4">
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-semibold text-gray-900 dark:text-white">{employee.name}</h4>
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  employee.role === 'Administrator' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                  'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                }`}>
                  {employee.role}
                </span>
              </div>
              {employee.jobTitle && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{employee.jobTitle}</p>
              )}
              <span className={`text-xs px-2 py-0.5 rounded inline-block ${
                employee.employeeType === 'full-time' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                employee.employeeType === 'part-time' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
              }`}>
                {employee.employeeType === 'full-time' ? 'Full-Time' :
                 employee.employeeType === 'part-time' ? 'Part-Time' : 'Contractor'}
              </span>
            </div>

            <div className="space-y-2 mb-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Available:</span>
                <span className="font-medium text-gray-900 dark:text-white">{totalHours}h</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Committed:</span>
                <span className="font-medium text-orange-600 dark:text-orange-400">{committedHours}h</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Remaining:</span>
                <span className={`font-medium ${availableHours > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {availableHours}h
                </span>
              </div>
            </div>

            {/* Utilization Bar */}
            <div className="mb-3">
              <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                <span>Utilization</span>
                <span>{utilizationPercent}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    utilizationPercent > 100 ? 'bg-red-500' :
                    utilizationPercent > 80 ? 'bg-orange-500' :
                    'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(utilizationPercent, 100)}%` }}
                />
              </div>
            </div>

            {/* Assigned Projects */}
            {employeeProjects.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Assigned Projects:</p>
                <div className="space-y-1">
                  {employeeProjects.map((project) => {
                    const projectHours = project.estimatedHours || 0;
                    const stageHours = project.stages
                      ?.filter(s => s.assignedTo === employee.name)
                      .reduce((sum, s) => sum + (s.estimatedHours || 0), 0) || 0;
                    const totalProjectHours = project.assignedTo === employee.name ? projectHours : stageHours;

                    return (
                      <div
                        key={project._id.toString()}
                        className="text-xs p-1.5 rounded"
                        style={{ backgroundColor: project.color + '20' }}
                      >
                        <div className="font-medium text-gray-900 dark:text-white truncate">
                          {project.name}
                        </div>
                        {totalProjectHours > 0 && (
                          <div className="text-gray-600 dark:text-gray-400">
                            {totalProjectHours}h
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
