'use client';

import { useMemo, useState, useCallback } from 'react';
import { IEmployee } from '@/lib/models/Employee';
import { IProject } from '@/lib/models/Project';
import { IOperation } from '@/lib/models/Operation';
import { TimeframeType, getTimeframeRange, formatDate } from '@/lib/utils/dateUtils';
import Card from '@/components/ui/Card';

interface EmployeeSidebarProps {
  employees: IEmployee[];
  projects: IProject[];
  operations: IOperation[];
  timeframe: TimeframeType;
  currentDate: Date;
  currentUserRole?: 'Administrator' | 'Manager' | 'User';
  currentUserEmployeeId?: string | null;
}

export default function EmployeeSidebar({ employees, projects, operations, timeframe, currentDate, currentUserRole, currentUserEmployeeId }: EmployeeSidebarProps) {
  const [expandedEmployees, setExpandedEmployees] = useState<Set<string>>(new Set());
  
  const range = getTimeframeRange(timeframe, currentDate);
  
  const toggleEmployee = useCallback((employeeId: string) => {
    setExpandedEmployees(prev => {
      const newSet = new Set(prev);
      if (newSet.has(employeeId)) {
        newSet.delete(employeeId);
      } else {
        newSet.add(employeeId);
      }
      return newSet;
    });
  }, []);
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
        durationDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1);
        // If start and end are the same day, duration should be exactly 1
        if (operationStart.toDateString() === operationEnd.toDateString()) {
          durationDays = 1;
        }
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
          // If durationDays > 1, add the extra days; if 1, keep same day
          if (durationDays > 1) {
            instanceEnd.setDate(instanceEnd.getDate() + durationDays - 1);
          }
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
          // If durationDays > 1, add the extra days; if 1, keep same day
          if (durationDays > 1) {
            instanceEnd.setDate(instanceEnd.getDate() + durationDays - 1);
          }
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
          // If durationDays > 1, add the extra days; if 1, keep same day
          if (durationDays > 1) {
            instanceEnd.setDate(instanceEnd.getDate() + durationDays - 1);
          }
          instanceEnd.setHours(23, 59, 59, 999);
          
          if (instanceStart <= viewEnd && instanceEnd >= viewStart) {
            instances.push({ operation, startDate: instanceStart, endDate: instanceEnd });
          }
          
          currentDate.setDate(currentDate.getDate() + 14);
        }
      }
      // For none: show operation only once if it falls within the view range
      else if (operation.recurrenceType === 'none') {
        const instanceStart = new Date(operationStart);
        instanceStart.setHours(0, 0, 0, 0);
        let instanceEnd: Date;
        if (operation.endDate) {
          // Use the operation's endDate
          const endDateObj = new Date(operation.endDate);
          const endDateStr = endDateObj.toISOString().split('T')[0];
          const [endYear, endMonth, endDay] = endDateStr.split('-').map(Number);
          instanceEnd = new Date(endYear, endMonth - 1, endDay);
        } else {
          // No endDate means single day operation
          instanceEnd = new Date(operationStart);
        }
        instanceEnd.setHours(23, 59, 59, 999);
        
        // Only add if it overlaps with the view range
        if (instanceStart <= viewEnd && instanceEnd >= viewStart) {
          instances.push({ operation, startDate: instanceStart, endDate: instanceEnd });
        }
      }
    });
    
    return instances;
  }, [operations, startDate, endDate]);

  // Helper function to count weekdays (Monday-Friday) between two dates
  const countWeekdays = (start: Date, end: Date): number => {
    let count = 0;
    const current = new Date(start);
    current.setHours(0, 0, 0, 0);
    const endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999);
    
    while (current <= endDate) {
      const dayOfWeek = current.getDay();
      // 0 = Sunday, 6 = Saturday, so weekdays are 1-5 (Monday-Friday)
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }
    
    return count;
  };

  // Calculate total available hours based on timeframe (weekdays only)
  const totalAvailableHours = (employee: IEmployee) => {
    if (timeframe === 'today') {
      // Check if today is a weekday
      const today = new Date(startDate);
      const dayOfWeek = today.getDay();
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        // Today is a weekday = weeklyHours / 5
        return Math.round((employee.weeklyHours / 5) * 100) / 100;
      } else {
        // Today is a weekend = 0 hours
        return 0;
      }
    }
    if (timeframe === 'weekly') {
      // Weekly is exactly 1 week = 5 weekdays
      return employee.weeklyHours;
    }
    
    // For other timeframes, count weekdays in the range
    const weekdays = countWeekdays(startDate, endDate);
    const weeks = weekdays / 5;
    const hours = employee.weeklyHours * weeks;
    return Math.round(hours * 100) / 100; // Round to 2 decimals
  };

  const getProjectsForEmployee = (employee: IEmployee) => {
    const result = projects.filter((project) => {
      const employeeIdStr = employee._id.toString();
      
      // Check if project is assigned to this employee by multiple IDs array (new preferred method)
      const projectAssignedToIds = (project as any).assignedToEmployeeIds;
      if (projectAssignedToIds && Array.isArray(projectAssignedToIds)) {
        if (projectAssignedToIds.some((id: any) => id?.toString() === employeeIdStr)) {
          return true;
        }
      }
      
      // Check if project is assigned to this employee by multiple names array
      const projectAssignedToNames = (project as any).assignedToNames;
      if (projectAssignedToNames && Array.isArray(projectAssignedToNames)) {
        if (projectAssignedToNames.includes(employee.name)) {
          return true;
        }
      }
      
      // Check if project is assigned to this employee by single ID (legacy)
      const projectAssignedToId = (project as any).assignedToEmployeeId?.toString();
      if (projectAssignedToId === employeeIdStr) {
        return true;
      }
      
      // Check if project is assigned by legacy name field
      if (project.assignedTo && project.assignedTo === employee.name) {
        return true;
      }
      
      // Check if any task is assigned to this employee by ID
      if (project.tasks && project.tasks.some(task => {
        const taskAssignedToId = (task as any).assignedToEmployeeId?.toString();
        if (taskAssignedToId === employee._id.toString()) {
          return true;
        }
        // Check legacy name field
        if (task.assignedTo && task.assignedTo === employee.name) {
          return true;
        }
        return false;
      })) {
        return true;
      }
      
      // Check if any operation linked to this project is assigned to this employee by ID
      if (operations.some(op => {
        const opAssignedToId = (op as any).assignedToEmployeeId?.toString();
        const isOpAssignedById = opAssignedToId === employee._id.toString();
        const isOpAssignedByName = op.assignedTo && op.assignedTo === employee.name;
        if (op.projectId?.toString() === project._id.toString() && (isOpAssignedById || isOpAssignedByName)) {
          return true;
        }
        return false;
      })) {
        return true;
      }
      
      return false;
    });
    
    return result;
  };

  const getOperationsForEmployee = (employee: IEmployee) => {
    return operationInstances.filter((instance) => {
      const op = instance.operation;
      const opAssignedToId = (op as any).assignedToEmployeeId?.toString();
      const opAssignedToIds = (op as any).assignedToEmployeeIds;
      const isAssignedById = opAssignedToId === employee._id.toString();
      const isAssignedByName = op.assignedTo && op.assignedTo === employee.name;
      const isAssignedByArray = opAssignedToIds && Array.isArray(opAssignedToIds) && 
        opAssignedToIds.some((id: any) => id?.toString() === employee._id.toString());
      return isAssignedById || isAssignedByName || isAssignedByArray;
    });
  };

  // Get operations directly from operations array (not just instances) for display
  // This includes operations without startDate which won't appear in operationInstances
  const getOperationsForEmployeeDirect = (employee: IEmployee) => {
    return operations.filter((operation) => {
      const opAssignedToId = (operation as any).assignedToEmployeeId?.toString();
      const opAssignedToIds = (operation as any).assignedToEmployeeIds;
      const isAssignedById = opAssignedToId === employee._id.toString();
      const isAssignedByName = operation.assignedTo && operation.assignedTo === employee.name;
      const isAssignedByArray = opAssignedToIds && Array.isArray(opAssignedToIds) && 
        opAssignedToIds.some((id: any) => id?.toString() === employee._id.toString());
      return isAssignedById || isAssignedByName || isAssignedByArray;
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

  // Helper function to calculate hours for a date range (weekdays only)
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
    
    // Calculate project duration in weekdays (Monday-Friday only)
    const projectDurationWeekdays = countWeekdays(normalizedProjectStart, normalizedProjectEnd);
    
    if (projectDurationWeekdays <= 0) return 0;
    
    // Calculate number of weekdays in the overlap
    const overlapWeekdays = countWeekdays(overlapStart, overlapEnd);
    
    // Ensure we have at least 1 weekday
    if (overlapWeekdays < 1) return 0;
    
    // Calculate hours for the overlap period (weekdays only)
    // Use precise calculation to avoid floating point errors
    const hoursForOverlap = (totalHours * overlapWeekdays) / projectDurationWeekdays;
    
    return hoursForOverlap;
  };

  const getCommittedHours = (employee: IEmployee) => {
    const employeeProjects = getProjectsForEmployee(employee);
    const employeeOperations = getOperationsForEmployee(employee);
    // Also get operations without startDate for hours calculation
    const directOps = getOperationsForEmployeeDirect(employee);
    const opsWithoutDate = directOps.filter(op => !op.startDate && op.status !== 'complete');
    let totalHours = 0;

    // Calculate hours from projects
    // NOTE: Completed projects and operations are excluded from committed hours
    // This ensures that marking items as complete frees up employee capacity
    employeeProjects.forEach((project) => {
      // Skip completed projects - they don't count toward committed hours
      if (project.status === 'launched') return;
      
      const projectStart = new Date(project.startDate);
      const projectEnd = new Date(project.endDate);
      
      // Calculate task hours assigned to this employee (count independently of project hours)
      let hasEmployeeTasks = false;
      let taskHoursInRange = 0;
      if (project.tasks && project.tasks.length > 0) {
        taskHoursInRange = project.tasks
          .filter(task => {
            const taskAssignedToId = (task as any).assignedToEmployeeId?.toString();
            return taskAssignedToId === employee._id.toString() && task.estimatedHours && task.status !== 'complete';
          })
          .reduce((sum, task) => {
            hasEmployeeTasks = true;
            if (!task.estimatedHours) return sum;
            const taskStart = new Date(task.startDate);
            const taskEnd = new Date(task.endDate);
            const hours = calculateHoursForDateRange(
              startDate,
              endDate,
              taskStart,
              taskEnd,
              task.estimatedHours
            );
            return sum + hours;
          }, 0);
        totalHours += taskHoursInRange;
      }
      
      // Check if there are operations attached to this project assigned to this employee in the current timeframe
      let hasEmployeeOperationsInRange = false;
      employeeOperations.forEach((instance) => {
        const operation = instance.operation;
        if (operation.projectId?.toString() === project._id.toString() && 
            operation.status !== 'complete') {
          // Check if this operation instance overlaps with the current timeframe
          const instanceStart = normalizeToStartOfDay(instance.startDate);
          const instanceEnd = normalizeToEndOfDay(instance.endDate);
          const rangeStart = normalizeToStartOfDay(startDate);
          const rangeEnd = normalizeToEndOfDay(endDate);
          
          if (instanceStart <= rangeEnd && instanceEnd >= rangeStart) {
            hasEmployeeOperationsInRange = true;
          }
        }
      });
      
      // If project is assigned to this employee AND there are no tasks assigned to this employee
      // AND there are no operations assigned to this employee for this project in this timeframe,
      // count remaining hours (project total - task hours assigned to others)
      // If there are tasks or operations assigned to this employee, we already counted those above, so skip project-level hours
      const projectAssignedToId = (project as any).assignedToEmployeeId?.toString();
      const isProjectAssignedToEmployee = projectAssignedToId === employee._id.toString();
      if (isProjectAssignedToEmployee && project.estimatedHours && !hasEmployeeTasks && !hasEmployeeOperationsInRange) {
        // Calculate total hours assigned to other employees via tasks
        let otherEmployeeTaskHours = 0;
        if (project.tasks && project.tasks.length > 0) {
          project.tasks.forEach((task) => {
            const taskAssignedToId = (task as any).assignedToEmployeeId?.toString();
            if (task.estimatedHours && task.status !== 'complete' && taskAssignedToId !== employee._id.toString()) {
              otherEmployeeTaskHours += task.estimatedHours;
            }
          });
        }
        
        // Project hours minus tasks assigned to others
        const remainingProjectHours = Math.max(0, project.estimatedHours - otherEmployeeTaskHours);
        
        if (remainingProjectHours > 0) {
          const hours = calculateHoursForDateRange(
            startDate,
            endDate,
            projectStart,
            projectEnd,
            remainingProjectHours
          );
          totalHours += hours;
        }
      }
    });

    // Calculate hours from operations
    employeeOperations.forEach((instance) => {
      const operation = instance.operation;
      // Skip completed operations - they don't count toward committed hours
      if (operation.status === 'complete') {
        return;
      }
      
      if (operation.estimatedHours !== undefined && operation.estimatedHours !== null) {
        // Calculate hours the same way as tasks - spread across duration using weekdays
        const instanceStart = normalizeToStartOfDay(instance.startDate);
        const instanceEnd = normalizeToEndOfDay(instance.endDate);
        
        // Ensure we're using a number, not a string
        const hours = typeof operation.estimatedHours === 'number' 
          ? operation.estimatedHours 
          : parseFloat(operation.estimatedHours);
        
        if (!isNaN(hours)) {
          // Use calculateHoursForDateRange to spread hours across the operation's duration
          const hoursInRange = calculateHoursForDateRange(
            startDate,
            endDate,
            instanceStart,
            instanceEnd,
            hours
          );
          totalHours += hoursInRange;
        }
      }
    });

    // Add hours from operations without startDate
    // For "today" timeframe, operations without dates shouldn't count (they have no specific day assignment)
    // For week/month timeframes, count them as full hours (they represent ongoing work)
    if (timeframe !== 'today') {
      opsWithoutDate.forEach((operation) => {
        if (operation.estimatedHours !== undefined && operation.estimatedHours !== null) {
          const hours = typeof operation.estimatedHours === 'number' 
            ? operation.estimatedHours 
            : parseFloat(operation.estimatedHours);
          
          if (!isNaN(hours)) {
            totalHours += hours;
          }
        }
      });
    }


    // Round to 2 decimal places for display
    return Math.round(totalHours * 100) / 100;
  };

  const getAvailableHours = (employee: IEmployee) => {
    const available = totalAvailableHours(employee);
    const committed = getCommittedHours(employee);
    return Math.round(Math.max(0, available - committed) * 100) / 100; // Round to 2 decimals
  };

  // Calculate completed hours for an employee (only items with status 'complete')
  const getCompletedHours = (employee: IEmployee) => {
    const employeeProjects = getProjectsForEmployee(employee);
    const employeeOperations = getOperationsForEmployee(employee);
    let totalHours = 0;

    // Calculate hours from completed projects
    employeeProjects.forEach((project) => {
      // Only count completed projects
      if (project.status !== 'launched') return;
      
      const projectStart = new Date(project.startDate);
      const projectEnd = new Date(project.endDate);
      
      // Calculate total task hours assigned to this employee (completed tasks only)
      let employeeTaskHours = 0;
      if (project.tasks && project.tasks.length > 0) {
        project.tasks.forEach((task) => {
          const taskAssignedToId = (task as any).assignedToEmployeeId?.toString();
          if (taskAssignedToId === employee._id.toString() && task.estimatedHours && task.status === 'complete') {
            employeeTaskHours += task.estimatedHours;
          }
        });
      }
      
      // If employee has completed tasks assigned, count those task hours
      if (employeeTaskHours > 0 && project.tasks) {
        const taskHoursInRange = project.tasks
          .filter(task => {
            const taskAssignedToId = (task as any).assignedToEmployeeId?.toString();
            return taskAssignedToId === employee._id.toString() && task.estimatedHours && task.status === 'complete';
          })
          .reduce((sum, task) => {
            if (!task.estimatedHours) return sum;
            const taskStart = new Date(task.startDate);
            const taskEnd = new Date(task.endDate);
            return sum + calculateHoursForDateRange(
              startDate,
              endDate,
              taskStart,
              taskEnd,
              task.estimatedHours
            );
          }, 0);
        totalHours += taskHoursInRange;
      }
      
      // If project is assigned to this employee and completed, count remaining hours
      const projectAssignedToId = (project as any).assignedToEmployeeId?.toString();
      if (projectAssignedToId === employee._id.toString() && project.estimatedHours) {
        // Calculate total hours assigned to other employees via completed tasks
        let otherEmployeeTaskHours = 0;
        if (project.tasks && project.tasks.length > 0) {
          project.tasks.forEach((task) => {
            const taskAssignedToId = (task as any).assignedToEmployeeId?.toString();
            if (task.estimatedHours && task.status === 'complete' && taskAssignedToId !== employee._id.toString()) {
              otherEmployeeTaskHours += task.estimatedHours;
            }
          });
        }
        
        // Project hours minus tasks assigned to others
        const remainingProjectHours = Math.max(0, project.estimatedHours - otherEmployeeTaskHours);
        
        if (remainingProjectHours > 0) {
          const hours = calculateHoursForDateRange(
            startDate,
            endDate,
            projectStart,
            projectEnd,
            remainingProjectHours
          );
          totalHours += hours;
        }
      }
    });

    // Calculate hours from completed operations
    employeeOperations.forEach((instance) => {
      const operation = instance.operation;
      // Only count completed operations
      if (operation.status !== 'complete') return;
      
      if (operation.estimatedHours !== undefined && operation.estimatedHours !== null) {
        // Calculate hours the same way as tasks - spread across duration using weekdays
        const instanceStart = normalizeToStartOfDay(instance.startDate);
        const instanceEnd = normalizeToEndOfDay(instance.endDate);
        
        const hours = typeof operation.estimatedHours === 'number' 
          ? operation.estimatedHours 
          : parseFloat(operation.estimatedHours);
        
        if (!isNaN(hours)) {
          // Use calculateHoursForDateRange to spread hours across the operation's duration
          const hoursInRange = calculateHoursForDateRange(
            startDate,
            endDate,
            instanceStart,
            instanceEnd,
            hours
          );
          totalHours += hoursInRange;
        }
      }
    });

    return Math.round(totalHours * 100) / 100;
  };

  if (employees.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <p className="mb-2">No employees added yet</p>
        <p className="text-sm">Add employees to track their workload</p>
      </div>
    );
  }

  // Filter employees based on role - memoized to recalculate when role or employee list changes
  const visibleEmployees = useMemo(() => {
    // Filter to only employees with userId (registered users)
    const employeesWithUserId = employees.filter(employee => employee.userId != null);
    
    // If role is not set yet, show all employees with userId (safer default)
    if (!currentUserRole) {
      return employeesWithUserId;
    }
    
    // Role-based filtering:
    // - Administrators: see all employees
    // - Managers: see all employees (users, managers, and admins)
    // - Users: see only themselves
    if (currentUserRole === 'User') {
      if (!currentUserEmployeeId) {
        return [];
      }
      return employeesWithUserId.filter(employee => {
        const employeeId = employee._id.toString();
        return employeeId === currentUserEmployeeId;
      });
    }
    
    // Managers and Administrators see all employees
    if (currentUserRole === 'Manager' || currentUserRole === 'Administrator') {
      return employeesWithUserId;
    }
    
    // Fallback: if role is something unexpected, show all
    return employeesWithUserId;
  }, [employees, currentUserRole, currentUserEmployeeId]);

  // Sort employees so current user's card appears first
  const sortedVisibleEmployees = useMemo(() => {
    if (!currentUserEmployeeId) return visibleEmployees;
    
    const sorted = [...visibleEmployees];
    const currentUserIndex = sorted.findIndex(emp => emp._id.toString() === currentUserEmployeeId);
    
    if (currentUserIndex > 0) {
      // Move current user to the top
      const [currentUser] = sorted.splice(currentUserIndex, 1);
      sorted.unshift(currentUser);
    }
    
    return sorted;
  }, [visibleEmployees, currentUserEmployeeId]);

  // Calculate team totals - only include visible employees (based on role)
  const teamTotals = sortedVisibleEmployees.reduce((totals, employee) => {
    const employeeProjects = getProjectsForEmployee(employee);
    const employeeOperations = getOperationsForEmployee(employee);
    let committedHours = 0;

    // Calculate hours from projects
    employeeProjects.forEach((project) => {
      // Skip completed projects - they don't count toward committed hours
      if (project.status === 'launched') return;
      
      const projectStart = new Date(project.startDate);
      const projectEnd = new Date(project.endDate);
      
      // Calculate task hours assigned to this employee (count independently of project hours)
      if (project.tasks && project.tasks.length > 0) {
        const taskHoursInRange = project.tasks
          .filter(task => {
            const taskAssignedToId = (task as any).assignedToEmployeeId?.toString();
            return taskAssignedToId === employee._id.toString() && task.estimatedHours && task.status !== 'complete';
          })
          .reduce((sum, task) => {
            if (!task.estimatedHours) return sum;
            const taskStart = new Date(task.startDate);
            const taskEnd = new Date(task.endDate);
            return sum + calculateHoursForDateRange(
              startDate,
              endDate,
              taskStart,
              taskEnd,
              task.estimatedHours
            );
          }, 0);
        committedHours += taskHoursInRange;
      }
      
      // If project is assigned to this employee, count remaining hours (project total - task hours assigned to others)
      const projectAssignedToId = (project as any).assignedToEmployeeId?.toString();
      if (projectAssignedToId === employee._id.toString() && project.estimatedHours) {
        // Calculate total hours assigned to other employees via tasks
        let otherEmployeeTaskHours = 0;
        if (project.tasks && project.tasks.length > 0) {
          project.tasks.forEach((task) => {
            const taskAssignedToId = (task as any).assignedToEmployeeId?.toString();
            if (task.estimatedHours && task.status !== 'complete' && taskAssignedToId !== employee._id.toString()) {
              otherEmployeeTaskHours += task.estimatedHours;
            }
          });
        }
        
        // Project hours minus tasks assigned to others
        const remainingProjectHours = Math.max(0, project.estimatedHours - otherEmployeeTaskHours);
        
        if (remainingProjectHours > 0) {
          const hours = calculateHoursForDateRange(
            startDate,
            endDate,
            projectStart,
            projectEnd,
            remainingProjectHours
          );
          committedHours += hours;
        }
      }
    });

    // Calculate hours from operations
    employeeOperations.forEach((instance) => {
      const operation = instance.operation;
      // Skip completed operations - they don't count toward committed hours
      if (operation.status === 'complete') return;
      
      if (operation.estimatedHours !== undefined && operation.estimatedHours !== null) {
        // Calculate hours the same way as tasks - spread across duration using weekdays
        const instanceStart = normalizeToStartOfDay(instance.startDate);
        const instanceEnd = normalizeToEndOfDay(instance.endDate);
        
        // Ensure we're using a number, not a string
        const hours = typeof operation.estimatedHours === 'number' 
          ? operation.estimatedHours 
          : parseFloat(operation.estimatedHours);
        
        if (!isNaN(hours)) {
          // Use calculateHoursForDateRange to spread hours across the operation's duration
          const hoursInRange = calculateHoursForDateRange(
            startDate,
            endDate,
            instanceStart,
            instanceEnd,
            hours
          );
          committedHours += hoursInRange;
        }
      }
    });

    // Calculate available hours based on weekdays only
    let availableHours;
    if (timeframe === 'today') {
      // Check if today is a weekday
      const today = new Date(startDate);
      const dayOfWeek = today.getDay();
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        // Today is a weekday = weeklyHours / 5
        availableHours = employee.weeklyHours / 5;
      } else {
        // Today is a weekend = 0 hours
        availableHours = 0;
      }
    } else if (timeframe === 'weekly') {
      // Weekly is exactly 1 week = 5 weekdays
      availableHours = employee.weeklyHours;
    } else {
      // For other timeframes, count weekdays in the range
      const weekdays = countWeekdays(startDate, endDate);
      const weeks = weekdays / 5;
      availableHours = employee.weeklyHours * weeks;
    }

    totals.totalAvailable += availableHours;
    totals.totalCommitted += committedHours;
    return totals;
  }, { totalAvailable: 0, totalCommitted: 0 });

  // Calculate team completed hours - only include visible employees (based on role)
  const teamCompleted = visibleEmployees.reduce((total, employee) => {
    return total + getCompletedHours(employee);
  }, 0);
  const teamCompletedRounded = Math.round(teamCompleted * 100) / 100;

  const teamAvailable = Math.round(teamTotals.totalAvailable * 100) / 100;
  const teamCommitted = Math.round(teamTotals.totalCommitted * 100) / 100;
  const teamRemaining = Math.round((teamAvailable - teamCommitted) * 100) / 100;

  return (
    <div className="space-y-4">
      <div className="mb-3">
        <h3 className="text-lg font-semibold text-white mb-2">Team Capacity</h3>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-300">Available:</span>
            <span className="font-medium text-white">{teamAvailable}h</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-300">Committed:</span>
            <span className="font-medium text-orange-400">{teamCommitted}h</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-300">Completed:</span>
            <span className="font-medium text-green-400">{teamCompletedRounded}h</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-300">Remaining:</span>
            <span className={`font-medium ${teamRemaining > 0 ? 'text-green-400' : 'text-red-400'}`}>
              {teamRemaining}h
            </span>
          </div>
        </div>
      </div>
      {sortedVisibleEmployees.map((employee) => {
        const employeeProjects = getProjectsForEmployee(employee);
        const committedHours = getCommittedHours(employee);
        const completedHours = getCompletedHours(employee);
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
                      className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <h4 className="font-semibold text-gray-900">{employee.name}</h4>
                  </button>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    employee.role === 'Administrator' ? 'bg-yellow-100 text-yellow-800' :
                    employee.role === 'Manager' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {employee.role}
                  </span>
                </div>
              </div>
              
              {/* Utilization Bar - Always visible */}
              <div className="mb-2">
                <div className="flex justify-between text-xs text-gray-600 mb-1">
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
                  <p className="text-sm text-gray-600 mb-2">{employee.jobTitle}</p>
                )}
                <span className={`text-xs px-2 py-0.5 rounded inline-block mb-3 ${
                  employee.employeeType === 'full-time' ? 'bg-blue-100 text-blue-800' :
                  employee.employeeType === 'part-time' ? 'bg-green-100 text-green-800' :
                  'bg-purple-100 text-purple-800'
                }`}>
                  {employee.employeeType === 'full-time' ? 'Full-Time' :
                   employee.employeeType === 'part-time' ? 'Part-Time' : 'Contractor'}
                </span>

                <div className="space-y-2 mb-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Available:</span>
                    <span className="font-medium text-gray-900">{totalHours}h</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Committed:</span>
                    <span className="font-medium text-orange-600">{committedHours}h</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Completed:</span>
                    <span className="font-medium text-green-600">{completedHours}h</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Remaining:</span>
                    <span className={`font-medium ${availableHours > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {availableHours}h
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* Assigned Operations - Only show when expanded */}
            {isExpanded && (() => {
              // Get instances for operations with startDate - these are already filtered by timeframe
              const employeeOps = getOperationsForEmployee(employee);
              const instanceMap = new Map();
              employeeOps.forEach(instance => {
                instanceMap.set(instance.operation._id.toString(), instance);
              });
              
              // Get operations directly from array (includes those without startDate)
              // Only show operations that either:
              // 1. Have an instance in the current timeframe (from instanceMap)
              // 2. Don't have a startDate (ongoing commitments)
              const directOps = getOperationsForEmployeeDirect(employee);
              const activeOps = directOps.filter(op => {
                if (op.status === 'complete') return false; // Note: Operations still use 'complete'
                // Only show operations that aren't linked to a project
                if (op.projectId) return false;
                // Show if it has an instance in the current timeframe
                if (instanceMap.has(op._id.toString())) return true;
                // Show if it doesn't have a startDate (ongoing commitment)
                if (!op.startDate) return true;
                // Otherwise, don't show it (it's not in the current timeframe)
                return false;
              });
              
              if (activeOps.length === 0) return null;
              
              return (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-xs font-medium text-gray-700 mb-2">Non Project Operations:</p>
                  <div className="space-y-1 max-h-[200px] overflow-y-auto">
                    {activeOps.map((operation, idx) => {
                      const instance = instanceMap.get(operation._id.toString());
                      // Ensure we're using a number, not a string
                      const hours = operation.estimatedHours !== undefined && operation.estimatedHours !== null
                        ? (typeof operation.estimatedHours === 'number' 
                            ? operation.estimatedHours 
                            : parseFloat(operation.estimatedHours))
                        : 0;
                      
                      // For operations with instances, calculate hours averaged by weekdays
                      let hoursInRange = 0;
                      let dueDate: Date | null = null;
                      let isDueToday = false;
                      
                      if (instance) {
                        const instanceStart = normalizeToStartOfDay(instance.startDate);
                        const instanceEnd = normalizeToEndOfDay(instance.endDate);
                        const rangeStart = normalizeToStartOfDay(startDate);
                        const rangeEnd = normalizeToEndOfDay(endDate);
                        
                        // Use calculateHoursForDateRange to average hours by weekdays
                        if (!isNaN(hours) && instanceStart <= rangeEnd && instanceEnd >= rangeStart) {
                          hoursInRange = calculateHoursForDateRange(
                            rangeStart,
                            rangeEnd,
                            instanceStart,
                            instanceEnd,
                            hours
                          );
                        }
                        
                        // Get due date (end date)
                        dueDate = instance.endDate;
                      } else if (operation.endDate) {
                        // Use operation's end date if no instance
                        dueDate = new Date(operation.endDate);
                        // For operations without startDate but with endDate, still calculate hours if they overlap
                        if (!isNaN(hours) && operation.startDate) {
                          const opStart = normalizeToStartOfDay(new Date(operation.startDate));
                          const opEnd = normalizeToEndOfDay(dueDate);
                          const rangeStart = normalizeToStartOfDay(startDate);
                          const rangeEnd = normalizeToEndOfDay(endDate);
                          
                          if (opStart <= rangeEnd && opEnd >= rangeStart) {
                            hoursInRange = calculateHoursForDateRange(
                              rangeStart,
                              rangeEnd,
                              opStart,
                              opEnd,
                              hours
                            );
                          }
                        } else if (!isNaN(hours)) {
                          // No start date, just show full hours
                          hoursInRange = hours;
                        }
                      } else if (!isNaN(hours)) {
                        // For operations without dates, show hours if they have estimatedHours
                        hoursInRange = hours;
                      }
                      
                      // Check if due date is today
                      if (dueDate) {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const dueDateNormalized = new Date(dueDate);
                        dueDateNormalized.setHours(0, 0, 0, 0);
                        isDueToday = dueDateNormalized.getTime() === today.getTime();
                      }
                      
                      return (
                        <div key={`operation-${operation._id.toString()}-${idx}`} className="text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-700 truncate flex-1">
                              {operation.name}
                            </span>
                            {hoursInRange > 0 && (
                              <span className="text-gray-600 ml-2">{hoursInRange.toFixed(2)}h</span>
                            )}
                          </div>
                          <div className="text-gray-500 dark:text-gray-500 text-[10px] mt-0.5">
                            {operation.recurrenceType === 'none' ? 'Non Recurring' : operation.recurrenceType}
                            {dueDate && (
                              <>
                                {' • Due Date: '}
                                {isDueToday ? 'Today' : dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </>
                            )}
                            {!dueDate && ' • No due date set'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Assigned Projects and Tasks - Only show when expanded */}
            {isExpanded && employeeProjects.length > 0 && (() => {
              // Show all projects assigned to employee, including launched ones (they may have operations)
              const projectsToShow = employeeProjects;
              if (projectsToShow.length === 0) return null;
              
              return (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-xs font-medium text-gray-700 mb-2">Assigned Projects:</p>
                  <div className="space-y-1 max-h-[300px] overflow-y-auto">
                    {projectsToShow.map((project) => {
                      const projectStart = new Date(project.startDate);
                      const projectEnd = new Date(project.endDate);
                      
                      // Check if employee is assigned to project or any tasks
                      // Show tasks even for launched projects if they're assigned to the employee
                      const projectAssignedToId = (project as any).assignedToEmployeeId?.toString();
                      const isAssignedToProject = projectAssignedToId === employee._id.toString();
                      const assignedTasks = project.tasks 
                        ? project.tasks.filter(task => {
                            const taskAssignedToId = (task as any).assignedToEmployeeId?.toString();
                            const taskAssignedToName = task.assignedTo;
                            // Check both employeeId and legacy name-based assignment
                            const isAssignedById = taskAssignedToId === employee._id.toString();
                            const isAssignedByName = taskAssignedToName && taskAssignedToName === employee.name;
                            return (isAssignedById || isAssignedByName) && task.status !== 'complete';
                          })
                        : [];
                      
                      // Get operations linked to this project that are assigned to this employee
                      // Use operation instances to get correct dates for recurring operations
                      // For recurring operations, we need ALL instances that fall within the timeframe, not just one
                      const assignedOperations: Array<{ operation: IOperation; startDate: Date; endDate: Date }> = [];
                      const seenInstanceKeys = new Set<string>();
                      
                      operationInstances.forEach(instance => {
                        const op = instance.operation;
                        const opAssignedToId = (op as any).assignedToEmployeeId?.toString();
                        const opAssignedToIds = (op as any).assignedToEmployeeIds;
                        const isAssignedById = opAssignedToId === employee._id.toString();
                        const isAssignedByName = op.assignedTo && op.assignedTo === employee.name;
                        const isAssignedByArray = opAssignedToIds && Array.isArray(opAssignedToIds) && 
                          opAssignedToIds.some((id: any) => id?.toString() === employee._id.toString());
                        const isAssignedToEmployee = isAssignedById || isAssignedByName || isAssignedByArray;
                        
                        if (op.projectId?.toString() === project._id.toString() &&
                            isAssignedToEmployee &&
                            op.status !== 'complete') {
                          // Check if this instance overlaps with the current timeframe
                          const instanceStart = normalizeToStartOfDay(instance.startDate);
                          const instanceEnd = normalizeToEndOfDay(instance.endDate);
                          const rangeStart = normalizeToStartOfDay(startDate);
                          const rangeEnd = normalizeToEndOfDay(endDate);
                          
                          // Only include instances that overlap with the timeframe
                          if (instanceStart <= rangeEnd && instanceEnd >= rangeStart) {
                            // Create a unique key for this instance (operation ID + start date + end date)
                            // This allows multiple instances of the same recurring operation
                            const instanceKey = `${op._id?.toString()}-${instance.startDate.getTime()}-${instance.endDate.getTime()}`;
                            if (!seenInstanceKeys.has(instanceKey)) {
                              assignedOperations.push(instance);
                              seenInstanceKeys.add(instanceKey);
                            }
                          }
                        }
                      });
                      
                      const finalAssignedOperations = assignedOperations;
                      
                      // Calculate project-level hours (remaining after ALL task assignments)
                      // Only calculate project-level hours if:
                      // 1. Employee is assigned to project AND
                      // 2. There are NO tasks assigned to this employee for this timeframe AND
                      // 3. There are NO operations assigned to this employee for this timeframe
                      // If there are tasks or operations assigned, those are shown separately and project-level hours shouldn't be counted
                      let totalProjectHours = 0;
                      if (isAssignedToProject && project.estimatedHours && assignedTasks.length === 0 && finalAssignedOperations.length === 0) {
                        // Calculate total hours assigned via tasks (to anyone, including this employee)
                        let totalTaskHours = 0;
                        if (project.tasks && project.tasks.length > 0) {
                          project.tasks.forEach((task) => {
                            if (task.assignedTo && task.estimatedHours && task.status !== 'complete') {
                              totalTaskHours += task.estimatedHours;
                            }
                          });
                        }
                        
                        // Project hours minus ALL task hours (tasks are shown separately)
                        const remainingProjectHours = Math.max(0, project.estimatedHours - totalTaskHours);
                        
                        if (remainingProjectHours > 0) {
                          totalProjectHours = calculateHoursForDateRange(
                            startDate,
                            endDate,
                            projectStart,
                            projectEnd,
                            remainingProjectHours
                          );
                          totalProjectHours = Math.round(totalProjectHours * 100) / 100;
                        }
                      }
                      
                      // Calculate task hours
                      const taskHoursList = assignedTasks.map(task => {
                        if (!task.estimatedHours) return null;
                        const taskStart = new Date(task.startDate);
                        const taskEnd = new Date(task.endDate);
                        // Normalize dates for overlap check
                        const normalizedTaskStart = normalizeToStartOfDay(taskStart);
                        const normalizedTaskEnd = normalizeToEndOfDay(taskEnd);
                        const normalizedRangeStart = normalizeToStartOfDay(startDate);
                        const normalizedRangeEnd = normalizeToEndOfDay(endDate);
                        
                        // Check if task overlaps with the timeframe
                        const overlaps = normalizedTaskStart <= normalizedRangeEnd && normalizedTaskEnd >= normalizedRangeStart;
                        if (!overlaps) return null;
                        
                        const hours = calculateHoursForDateRange(
                          startDate,
                          endDate,
                          taskStart,
                          taskEnd,
                          task.estimatedHours
                        );
                        const roundedHours = Math.round(hours * 100) / 100;
                        // Include tasks that overlap the timeframe, even if hours round to 0
                        // This ensures tasks spanning multiple months show up correctly
                        return {
                          name: task.name,
                          hours: Math.max(0, roundedHours), // Ensure non-negative
                          dueDate: taskEnd
                        };
                      }).filter(Boolean) as Array<{ name: string; hours: number; dueDate: Date }>;
                      
                      // Calculate operation hours - for recurring operations, sum hours from all instances
                      const operationHoursMap = new Map<string, { name: string; hours: number; dueDate: Date | null; operationId: string }>();
                      finalAssignedOperations.forEach(instance => {
                        const op = instance.operation;
                        if (!op.estimatedHours) return;
                        const opId = op._id?.toString();
                        if (!opId) return; // Skip if no ID
                        
                        // Use instance dates for proper calculation and display
                        const opStart = normalizeToStartOfDay(instance.startDate);
                        const opEnd = normalizeToEndOfDay(instance.endDate);
                        const hours = calculateHoursForDateRange(
                          startDate,
                          endDate,
                          opStart,
                          opEnd,
                          op.estimatedHours
                        );
                        const roundedHours = Math.round(hours * 100) / 100;
                        // Include operations that overlap the timeframe, even if hours round to 0
                        // This ensures small operations (like 0.5h) show up correctly
                        // Check if operation overlaps with timeframe
                        const normalizedOpStart = normalizeToStartOfDay(opStart);
                        const normalizedOpEnd = normalizeToEndOfDay(opEnd);
                        const normalizedRangeStart = normalizeToStartOfDay(startDate);
                        const normalizedRangeEnd = normalizeToEndOfDay(endDate);
                        const overlaps = normalizedOpStart <= normalizedRangeEnd && normalizedOpEnd >= normalizedRangeStart;
                        if (!overlaps) return;
                        
                        // Use Math.max to ensure we don't have negative values, but include even very small positive values
                        const finalHours = Math.max(0, roundedHours);
                        
                        // For recurring operations, accumulate hours from all instances
                        if (operationHoursMap.has(opId)) {
                          const existing = operationHoursMap.get(opId)!;
                          existing.hours += finalHours;
                          existing.hours = Math.round(existing.hours * 100) / 100;
                          // Update due date to the latest instance's end date
                          if (instance.endDate > (existing.dueDate || new Date(0))) {
                            existing.dueDate = new Date(instance.endDate);
                          }
                        } else {
                          operationHoursMap.set(opId, {
                            name: op.name,
                            hours: finalHours,
                            dueDate: new Date(instance.endDate), // Use instance endDate for correct display
                            operationId: opId
                          });
                        }
                      });
                      const operationHoursList = Array.from(operationHoursMap.values());
                      
                      // Show project if employee is assigned to it, has incomplete tasks assigned, or has operations assigned
                      // Don't show if only assigned to project but all tasks are completed
                      // Don't filter by hours - show all assigned projects regardless of hours in current timeframe
                      const hasIncompleteTasks = assignedTasks.length > 0;
                      const hasOperations = finalAssignedOperations.length > 0;
                      // Show project if:
                      // 1. Employee is assigned to project (regardless of tasks/operations)
                      // 2. Employee has incomplete tasks assigned
                      // 3. Employee has operations assigned
                      const showProject = isAssignedToProject || hasIncompleteTasks || hasOperations;
                      
                      if (!showProject) {
                        return null;
                      }
                      
                      // Show project name if employee is assigned to project, has tasks assigned, or has operations assigned
                      const showProjectName = isAssignedToProject || assignedTasks.length > 0 || finalAssignedOperations.length > 0;
                      
                      // Get project due date (end date)
                      const projectDueDate = projectEnd;
                      const isProjectDueToday = (() => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const dueDateNormalized = new Date(projectDueDate);
                        dueDateNormalized.setHours(0, 0, 0, 0);
                        return dueDateNormalized.getTime() === today.getTime();
                      })();
                      
                      return (
                        <div key={project._id.toString()} className="space-y-1">
                          {/* Project Name and Hours */}
                          {showProjectName && (
                            <div
                              className="text-xs p-1.5 rounded"
                              style={{ backgroundColor: project.color + '20' }}
                            >
                              <div className="font-medium text-gray-900 truncate">
                                {project.name}
                              </div>
                              {totalProjectHours > 0 && (
                                <div className="text-gray-600">
                                  {totalProjectHours}h
                                </div>
                              )}
                              <div className="text-gray-500 text-[10px] mt-0.5">
                                {project.status === 'launched' ? 'End Date' : 'Due Date'}: {isProjectDueToday ? 'Today' : formatDate(projectDueDate)}
                              </div>
                            </div>
                          )}
                          
                          {/* Tasks */}
                          {taskHoursList.map((taskInfo, idx) => {
                            const isTaskDueToday = (() => {
                              const today = new Date();
                              today.setHours(0, 0, 0, 0);
                              const dueDateNormalized = new Date(taskInfo.dueDate);
                              dueDateNormalized.setHours(0, 0, 0, 0);
                              return dueDateNormalized.getTime() === today.getTime();
                            })();
                            
                            return (
                              <div
                                key={`task-${project._id.toString()}-${idx}`}
                                className="text-xs p-1.5 rounded ml-3"
                                style={{ backgroundColor: project.color + '15' }}
                              >
                                <div className="text-gray-700 truncate">
                                  • {taskInfo.name}
                                </div>
                                <div className="text-gray-600">
                                  {taskInfo.hours}h
                                </div>
                                <div className="text-gray-500 text-[10px] mt-0.5">
                                  Due Date: {isTaskDueToday ? 'Today' : formatDate(taskInfo.dueDate)}
                                </div>
                              </div>
                            );
                          })}
                          
                          {/* Operations */}
                          {operationHoursList.map((opInfo) => {
                            if (!opInfo.dueDate) return null;
                            const isOpDueToday = (() => {
                              const today = new Date();
                              today.setHours(0, 0, 0, 0);
                              const dueDateNormalized = new Date(opInfo.dueDate);
                              dueDateNormalized.setHours(0, 0, 0, 0);
                              return dueDateNormalized.getTime() === today.getTime();
                            })();
                            
                            return (
                              <div
                                key={`operation-${project._id.toString()}-${opInfo.operationId}`}
                                className="text-xs p-1.5 rounded ml-3"
                                style={{ backgroundColor: project.color + '15' }}
                              >
                                <div className="text-gray-700 truncate">
                                  • {opInfo.name}
                                </div>
                                <div className="text-gray-600">
                                  {opInfo.hours}h
                                </div>
                                <div className="text-gray-500 text-[10px] mt-0.5">
                                  Due Date: {isOpDueToday ? 'Today' : formatDate(opInfo.dueDate)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </Card>
        );
      })}
    </div>
  );
}
