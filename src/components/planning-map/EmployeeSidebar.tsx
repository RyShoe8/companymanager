'use client';

import { useMemo, useState } from 'react';
import { IEmployee } from '@/lib/models/Employee';
import { IProject } from '@/lib/models/Project';
import { IOperation } from '@/lib/models/Operation';
import { TimeframeType, getTimeframeRange } from '@/lib/utils/dateUtils';
import Card from '@/components/ui/Card';

interface EmployeeSidebarProps {
  employees: IEmployee[];
  projects: IProject[];
  operations: IOperation[];
  timeframe: TimeframeType;
  currentDate: Date;
}

export default function EmployeeSidebar({ employees, projects, operations, timeframe, currentDate }: EmployeeSidebarProps) {
  const [expandedEmployees, setExpandedEmployees] = useState<Set<string>>(new Set());
  const range = getTimeframeRange(timeframe, currentDate);
  
  const toggleEmployee = (employeeId: string) => {
    setExpandedEmployees(prev => {
      const newSet = new Set(prev);
      if (newSet.has(employeeId)) {
        newSet.delete(employeeId);
      } else {
        newSet.add(employeeId);
      }
      return newSet;
    });
  };
  // Normalize start date to beginning of day, end date to end of day for accurate calculations
  const startDate = new Date(range.start);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(range.end);
  // Keep end date at end of day (23:59:59.999) to include the full day
  endDate.setHours(23, 59, 59, 999);

  // Generate recurring instances of operations for the current timeframe
  const operationInstances = useMemo(() => {
    const viewStart = new Date(startDate);
    viewStart.setHours(0, 0, 0, 0);
    const viewEnd = new Date(endDate);
    viewEnd.setHours(23, 59, 59, 999);
    
    const instances: Array<{ operation: IOperation; startDate: Date; endDate: Date }> = [];
    
    operations.forEach((operation) => {
      if (!operation.startDate) return; // Skip operations without start date
      
      // Parse date to avoid timezone issues - extract YYYY-MM-DD and create local date
      const startDateObj = new Date(operation.startDate);
      const startDateStr = startDateObj.toISOString().split('T')[0];
      const [year, month, day] = startDateStr.split('-').map(Number);
      const operationStart = new Date(year, month - 1, day);
      operationStart.setHours(0, 0, 0, 0);
      
      // Calculate duration (default to 1 day if no endDate)
      let durationDays: number;
      if (operation.endDate) {
        // Parse end date to avoid timezone issues
        const endDateObj = new Date(operation.endDate);
        const endDateStr = endDateObj.toISOString().split('T')[0];
        const [endYear, endMonth, endDay] = endDateStr.split('-').map(Number);
        const operationEnd = new Date(endYear, endMonth - 1, endDay);
        operationEnd.setHours(23, 59, 59, 999);
        // Calculate days between start and end (inclusive)
        const diffMs = operationEnd.getTime() - operationStart.getTime();
        durationDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1;
      } else {
        // No endDate means single day operation
        durationDays = 1;
      }
      
      // Generate recurring instances based on recurrence type
      let currentDate = new Date(operationStart);
      
      // For monthly: find all occurrences in the same day of month
      if (operation.recurrenceType === 'monthly') {
        const dayOfMonth = operationStart.getDate();
        // Start from the operation's start date, not before
        currentDate = new Date(operationStart);
        currentDate.setHours(0, 0, 0, 0);
        
        // If the operation start is before viewStart, find the first occurrence in or after viewStart
        if (currentDate < viewStart) {
          // Find the first month where this day of month is >= viewStart
          currentDate = new Date(viewStart.getFullYear(), viewStart.getMonth(), dayOfMonth);
          if (currentDate < viewStart) {
            // This month's occurrence is before viewStart, move to next month
            currentDate = new Date(viewStart.getFullYear(), viewStart.getMonth() + 1, dayOfMonth);
          }
        }
        
        // Generate instances for the view range, but only from operationStart forward
        while (currentDate <= viewEnd) {
          // Ensure we don't go before the operation's start date
          if (currentDate < operationStart) {
            currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, dayOfMonth);
            continue;
          }
          
          const instanceStart = new Date(currentDate);
          instanceStart.setHours(0, 0, 0, 0);
          const instanceEnd = new Date(instanceStart);
          // If durationDays = 1, instanceEnd stays the same day (1 day operation)
          instanceEnd.setDate(instanceEnd.getDate() + durationDays - 1);
          instanceEnd.setHours(23, 59, 59, 999);
          
          if (instanceStart <= viewEnd && instanceEnd >= viewStart) {
            instances.push({ operation, startDate: instanceStart, endDate: instanceEnd });
          }
          
          // Move to next month
          currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, dayOfMonth);
        }
      }
      // For weekly: same day of week
      else if (operation.recurrenceType === 'weekly') {
        const dayOfWeek = operationStart.getDay();
        // Start from the operation's start date
        currentDate = new Date(operationStart);
        currentDate.setHours(0, 0, 0, 0);
        
        // If the operation start is before viewStart, find the first occurrence >= viewStart
        if (currentDate < viewStart) {
          // Find the first Monday of the view range
          const viewStartDay = viewStart.getDay();
          const mondayOffset = viewStartDay === 0 ? 6 : viewStartDay - 1;
          const firstMonday = new Date(viewStart);
          firstMonday.setDate(firstMonday.getDate() - mondayOffset);
          
          // Find the first occurrence in or after the view
          const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
          currentDate = new Date(firstMonday);
          currentDate.setDate(currentDate.getDate() + daysFromMonday);
          
          // If before viewStart, move to next week
          if (currentDate < viewStart) {
            currentDate.setDate(currentDate.getDate() + 7);
          }
        }
        
        while (currentDate <= viewEnd) {
          // Ensure we don't go before the operation's start date
          if (currentDate < operationStart) {
            currentDate.setDate(currentDate.getDate() + 7);
            continue;
          }
          
          const instanceStart = new Date(currentDate);
          instanceStart.setHours(0, 0, 0, 0);
          const instanceEnd = new Date(instanceStart);
          // If durationDays = 1, instanceEnd stays the same day (1 day operation)
          instanceEnd.setDate(instanceEnd.getDate() + durationDays - 1);
          instanceEnd.setHours(23, 59, 59, 999);
          
          if (instanceStart <= viewEnd && instanceEnd >= viewStart) {
            instances.push({ operation, startDate: instanceStart, endDate: instanceEnd });
          }
          
          currentDate.setDate(currentDate.getDate() + 7);
        }
      }
      // For bi-weekly: same day of week, every 2 weeks
      else if (operation.recurrenceType === 'bi-weekly') {
        const dayOfWeek = operationStart.getDay();
        // Start from the operation's start date
        currentDate = new Date(operationStart);
        currentDate.setHours(0, 0, 0, 0);
        
        // If the operation start is before viewStart, find the first occurrence >= viewStart
        if (currentDate < viewStart) {
          // Find first Monday of the view range
          const viewStartDay = viewStart.getDay();
          const mondayOffset = viewStartDay === 0 ? 6 : viewStartDay - 1;
          const firstMonday = new Date(viewStart);
          firstMonday.setDate(firstMonday.getDate() - mondayOffset);
          
          // Find the first occurrence in or after the view
          const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
          let candidateDate = new Date(firstMonday);
          candidateDate.setDate(candidateDate.getDate() + daysFromMonday);
          
          // Find the closest bi-weekly occurrence to operationStart that's >= viewStart
          // Calculate how many weeks from operationStart to candidateDate
          const weeksDiff = Math.floor((candidateDate.getTime() - operationStart.getTime()) / (1000 * 60 * 60 * 24 * 7));
          // Round to nearest bi-weekly interval (multiple of 2)
          const adjustedWeeks = Math.ceil(weeksDiff / 2) * 2;
          currentDate = new Date(operationStart);
          currentDate.setDate(currentDate.getDate() + adjustedWeeks * 7);
          
          // If still before viewStart, move to next bi-weekly occurrence
          if (currentDate < viewStart) {
            currentDate.setDate(currentDate.getDate() + 14);
          }
        }
        
        while (currentDate <= viewEnd) {
          // Ensure we don't go before the operation's start date
          if (currentDate < operationStart) {
            currentDate.setDate(currentDate.getDate() + 14);
            continue;
          }
          
          const instanceStart = new Date(currentDate);
          instanceStart.setHours(0, 0, 0, 0);
          const instanceEnd = new Date(instanceStart);
          // If durationDays = 1, instanceEnd stays the same day (1 day operation)
          instanceEnd.setDate(instanceEnd.getDate() + durationDays - 1);
          instanceEnd.setHours(23, 59, 59, 999);
          
          if (instanceStart <= viewEnd && instanceEnd >= viewStart) {
            instances.push({ operation, startDate: instanceStart, endDate: instanceEnd });
          }
          
          currentDate.setDate(currentDate.getDate() + 14);
        }
      }
    });
    
    return instances;
  }, [operations, startDate, endDate]);

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

  const getOperationsForEmployee = (employeeName: string) => {
    return operationInstances.filter((instance) => {
      return instance.operation.assignedTo === employeeName;
    });
  };

  // Helper function to normalize date to start of day
  const normalizeToStartOfDay = (date: Date): Date => {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  };

  // Helper function to normalize date to end of day
  const normalizeToEndOfDay = (date: Date): Date => {
    const normalized = new Date(date);
    normalized.setHours(23, 59, 59, 999);
    return normalized;
  };

  // Helper function to calculate hours for a date range
  const calculateHoursForDateRange = (
    rangeStart: Date,
    rangeEnd: Date,
    projectStart: Date,
    projectEnd: Date,
    totalHours: number
  ): number => {
    // Normalize project dates: start to beginning of day, end to end of day (inclusive)
    // Note: HTML date inputs store dates as YYYY-MM-DD 00:00:00, so endDate at Day 10 means Day 10 00:00:00
    // We need to treat this as inclusive of Day 10, so normalize to end of Day 10
    const normalizedProjectStart = normalizeToStartOfDay(projectStart);
    const normalizedProjectEnd = normalizeToEndOfDay(projectEnd);
    
    // Normalize range dates: start to beginning of day, end to end of day
    const normalizedRangeStart = normalizeToStartOfDay(rangeStart);
    const normalizedRangeEnd = normalizeToEndOfDay(rangeEnd);
    
    // Find the overlap between project dates and the timeframe
    // Compare dates properly: if project starts after range ends or project ends before range starts, no overlap
    if (normalizedProjectStart.getTime() > normalizedRangeEnd.getTime() || 
        normalizedProjectEnd.getTime() < normalizedRangeStart.getTime()) {
      return 0;
    }
    
    const overlapStart = normalizedProjectStart > normalizedRangeStart ? normalizedProjectStart : normalizedRangeStart;
    const overlapEnd = normalizedProjectEnd < normalizedRangeEnd ? normalizedProjectEnd : normalizedRangeEnd;
    
    // If no overlap, return 0
    if (overlapStart.getTime() > overlapEnd.getTime()) return 0;
    
    // Calculate project duration in days (inclusive of both start and end dates)
    // Example: Day 1 00:00:00 to Day 10 23:59:59 = 10 days (1, 2, 3, 4, 5, 6, 7, 8, 9, 10)
    const normalizedProjectStartForDuration = normalizeToStartOfDay(projectStart);
    const normalizedProjectEndForDuration = normalizeToStartOfDay(projectEnd);
    const projectDurationMs = normalizedProjectEndForDuration.getTime() - normalizedProjectStartForDuration.getTime();
    const projectDurationDays = Math.floor(projectDurationMs / (1000 * 60 * 60 * 24)) + 1;
    
    if (projectDurationDays <= 0) return 0;
    
    // Calculate hours per day
    const hoursPerDay = totalHours / projectDurationDays;
    
    // Calculate number of days in the overlap (inclusive of both start and end dates)
    // Convert overlapStart to start of day
    const overlapStartForDays = normalizeToStartOfDay(overlapStart);
    
    // For overlapEnd, if it's at end of day (23:59:59.999), we need to ensure we count that full day
    // When we normalize Day 10 23:59:59.999 to start of day, we get Day 10 00:00:00
    // But for accurate day counting when the end is at end of day, we should treat it as
    // the start of the next day (exclusive), which means the current day is included
    // So: Day 10 23:59:59.999 -> Day 11 00:00:00 (exclusive) means Day 10 is included
    // For counting: Day 8 00:00:00 to Day 11 00:00:00 (exclusive) = 3 days (8, 9, 10)
    const overlapEndIsEndOfDay = overlapEnd.getHours() === 23 && 
                                  overlapEnd.getMinutes() === 59 && 
                                  overlapEnd.getSeconds() === 59;
    
    let overlapEndForDays: Date;
    if (overlapEndIsEndOfDay) {
      // If at end of day, add 1 day then normalize to start of day to get the next day
      // This way, when we calculate days, we get the correct count
      const nextDay = new Date(overlapEnd.getTime() + 24 * 60 * 60 * 1000);
      overlapEndForDays = normalizeToStartOfDay(nextDay);
    } else {
      overlapEndForDays = normalizeToStartOfDay(overlapEnd);
    }
    
    // Calculate days: Day 8 00:00:00 to Day 11 00:00:00 (exclusive) = 3 days (8, 9, 10)
    // Since overlapEndForDays is now the start of the day AFTER the last day we want to count,
    // we don't need the +1
    const overlapMs = overlapEndForDays.getTime() - overlapStartForDays.getTime();
    const overlapDays = Math.floor(overlapMs / (1000 * 60 * 60 * 24));
    
    // Ensure we have at least 1 day
    if (overlapDays < 1) return 0;
    
    // Return hours for the overlap period
    return hoursPerDay * overlapDays;
  };

  const getCommittedHours = (employee: IEmployee) => {
    const employeeProjects = getProjectsForEmployee(employee.name);
    const employeeOperations = getOperationsForEmployee(employee.name);
    let totalHours = 0;

    // Calculate hours from projects
    employeeProjects.forEach((project) => {
      // Skip completed projects - they don't count toward committed hours
      if (project.status === 'complete') return;
      
      const projectStart = new Date(project.startDate);
      const projectEnd = new Date(project.endDate);
      
      // Check if whole project is assigned
      if (project.assignedTo === employee.name && project.estimatedHours) {
        const hours = calculateHoursForDateRange(
          startDate,
          endDate,
          projectStart,
          projectEnd,
          project.estimatedHours
        );
        totalHours += hours;
      }
      
      // Check stages assigned to this employee (only if stage is not complete)
      if (project.stages) {
        project.stages.forEach((stage) => {
          if (stage.assignedTo === employee.name && stage.estimatedHours && stage.status !== 'complete') {
            const stageStart = new Date(stage.startDate);
            const stageEnd = new Date(stage.endDate);
            const hours = calculateHoursForDateRange(
              startDate,
              endDate,
              stageStart,
              stageEnd,
              stage.estimatedHours
            );
            totalHours += hours;
          }
        });
      }
    });

    // Calculate hours from operations
    employeeOperations.forEach((instance) => {
      const operation = instance.operation;
      // Skip completed operations - they don't count toward committed hours
      if (operation.status === 'complete') return;
      
      if (operation.estimatedHours) {
        // For operations, the hours are for each instance (not spread across duration)
        // So if an operation is 2 hours and recurs weekly, each week gets 2 hours
        const hours = calculateHoursForDateRange(
          startDate,
          endDate,
          instance.startDate,
          instance.endDate,
          operation.estimatedHours
        );
        totalHours += hours;
      }
    });

    return Math.round(totalHours * 10) / 10; // Round to 1 decimal
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
    const employeeOperations = getOperationsForEmployee(employee.name);
    let committedHours = 0;

    // Calculate hours from projects
    employeeProjects.forEach((project) => {
      // Skip completed projects - they don't count toward committed hours
      if (project.status === 'complete') return;
      
      const projectStart = new Date(project.startDate);
      const projectEnd = new Date(project.endDate);
      
      if (project.assignedTo === employee.name && project.estimatedHours) {
        const hours = calculateHoursForDateRange(
          startDate,
          endDate,
          projectStart,
          projectEnd,
          project.estimatedHours
        );
        committedHours += hours;
      }
      if (project.stages) {
        project.stages.forEach((stage) => {
          if (stage.assignedTo === employee.name && stage.estimatedHours && stage.status !== 'complete') {
            const stageStart = new Date(stage.startDate);
            const stageEnd = new Date(stage.endDate);
            const hours = calculateHoursForDateRange(
              startDate,
              endDate,
              stageStart,
              stageEnd,
              stage.estimatedHours
            );
            committedHours += hours;
          }
        });
      }
    });

    // Calculate hours from operations
    employeeOperations.forEach((instance) => {
      const operation = instance.operation;
      // Skip completed operations - they don't count toward committed hours
      if (operation.status === 'complete') return;
      
      if (operation.estimatedHours) {
        const hours = calculateHoursForDateRange(
          startDate,
          endDate,
          instance.startDate,
          instance.endDate,
          operation.estimatedHours
        );
        committedHours += hours;
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

        const employeeId = employee._id.toString();
        const isExpanded = expandedEmployees.has(employeeId);

        return (
          <Card key={employeeId} className="p-4">
            {/* Header - Always visible */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 flex-1">
                  <button
                    onClick={() => toggleEmployee(employeeId)}
                    className="flex items-center gap-2 flex-1 text-left hover:opacity-80 transition-opacity"
                  >
                    <svg
                      className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <h4 className="font-semibold text-gray-900 dark:text-white">{employee.name}</h4>
                  </button>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    employee.role === 'Administrator' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                    employee.role === 'Manager' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                    'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                  }`}>
                    {employee.role}
                  </span>
                </div>
              </div>
              
              {/* Utilization Bar - Always visible */}
              <div className="mb-2">
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
            </div>

            {/* Expanded Content */}
            {isExpanded && (
              <>
                {employee.jobTitle && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{employee.jobTitle}</p>
                )}
                <span className={`text-xs px-2 py-0.5 rounded inline-block mb-3 ${
                  employee.employeeType === 'full-time' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                  employee.employeeType === 'part-time' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                  'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                }`}>
                  {employee.employeeType === 'full-time' ? 'Full-Time' :
                   employee.employeeType === 'part-time' ? 'Part-Time' : 'Contractor'}
                </span>

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
              </>
            )}

            {/* Assigned Operations - Only show when expanded */}
            {isExpanded && (() => {
              const employeeOps = getOperationsForEmployee(employee.name);
              const activeOps = employeeOps.filter(instance => instance.operation.status !== 'complete');
              
              if (activeOps.length === 0) return null;
              
              return (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Assigned Operations:</p>
                  <div className="space-y-1">
                    {activeOps.map((instance, idx) => {
                      const operation = instance.operation;
                      const hours = operation.estimatedHours || 0;
                      const hoursInRange = calculateHoursForDateRange(
                        startDate,
                        endDate,
                        instance.startDate,
                        instance.endDate,
                        hours
                      );
                      
                      return (
                        <div key={`operation-${operation._id.toString()}-${instance.startDate.getTime()}-${idx}`} className="text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-700 dark:text-gray-300 truncate flex-1">{operation.name}</span>
                            {hoursInRange > 0 && (
                              <span className="text-gray-600 dark:text-gray-400 ml-2">{hoursInRange.toFixed(1)}h</span>
                            )}
                          </div>
                          <div className="text-gray-500 dark:text-gray-500 text-[10px] mt-0.5">
                            {operation.recurrenceType} • {instance.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Assigned Projects - Only show when expanded */}
            {isExpanded && employeeProjects.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Assigned Projects:</p>
                <div className="space-y-1">
                  {employeeProjects.map((project) => {
                    // Skip completed projects in the display
                    if (project.status === 'complete') return null;
                    
                    const projectStart = new Date(project.startDate);
                    const projectEnd = new Date(project.endDate);
                    
                    let totalProjectHours = 0;
                    
                    // Calculate hours for the whole project if assigned
                    if (project.assignedTo === employee.name && project.estimatedHours) {
                      totalProjectHours += calculateHoursForDateRange(
                        startDate,
                        endDate,
                        projectStart,
                        projectEnd,
                        project.estimatedHours
                      );
                    }
                    
                    // Calculate hours for stages assigned to this employee
                    if (project.stages) {
                      project.stages.forEach((stage) => {
                        if (stage.assignedTo === employee.name && stage.estimatedHours && stage.status !== 'complete') {
                          const stageStart = new Date(stage.startDate);
                          const stageEnd = new Date(stage.endDate);
                          totalProjectHours += calculateHoursForDateRange(
                            startDate,
                            endDate,
                            stageStart,
                            stageEnd,
                            stage.estimatedHours
                          );
                        }
                      });
                    }
                    
                    // Round to 1 decimal
                    totalProjectHours = Math.round(totalProjectHours * 10) / 10;

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
