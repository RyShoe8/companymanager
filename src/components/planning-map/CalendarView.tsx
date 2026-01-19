'use client';

import { useState, useEffect, useMemo } from 'react';
import { IProject } from '@/lib/models/Project';
import { IOperation } from '@/lib/models/Operation';
import { TimeframeType, formatDate, getTimeframeRange } from '@/lib/utils/dateUtils';
import Button from '@/components/ui/Button';

interface CalendarViewProps {
  projects: IProject[];
  operations: IOperation[];
  timeframe: TimeframeType;
  currentDate: Date;
  onProjectClick: (project: IProject) => void;
  onOperationClick: (operation: IOperation) => void;
  onDateChange?: (date: Date) => void;
  currentUserEmployeeName?: string | null;
  currentUserEmployeeId?: string | null;
  isManagerOrAdmin?: boolean;
}

export default function CalendarView({ projects, operations, timeframe, currentDate, onProjectClick, onOperationClick, onDateChange, currentUserEmployeeName, currentUserEmployeeId, isManagerOrAdmin = false }: CalendarViewProps) {
  const [viewDate, setViewDate] = useState(currentDate);
  const [employees, setEmployees] = useState<any[]>([]);
  const [projectLatestComments, setProjectLatestComments] = useState<Map<string, Date>>(new Map());
  
  // Load expanded projects from localStorage on mount
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('calendar-expanded-projects');
      if (saved) {
        try {
          const projectIds = JSON.parse(saved);
          return new Set(projectIds);
        } catch (e) {
          return new Set();
        }
      }
    }
    return new Set();
  });
  
  // Save expanded projects to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const projectIds = Array.from(expandedProjects);
      localStorage.setItem('calendar-expanded-projects', JSON.stringify(projectIds));
    }
  }, [expandedProjects]);

  // Fetch employees to resolve names from IDs
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const response = await fetch('/api/employees');
        if (response.ok) {
          const data = await response.json();
          setEmployees(data);
        }
      } catch (error) {
        // Error fetching employees
      }
    };
    fetchEmployees();
  }, []);

  // Fetch latest comment timestamps for all projects
  useEffect(() => {
    const fetchLatestComments = async () => {
      const commentMap = new Map<string, Date>();
      
      // Get last refresh time from localStorage
      let lastRefreshTime: Date | null = null;
      if (typeof window !== 'undefined') {
        const savedRefreshTime = localStorage.getItem('calendar-last-refresh-time');
        if (savedRefreshTime) {
          try {
            lastRefreshTime = new Date(savedRefreshTime);
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
      
      // If no last refresh time, set it to now (first time loading)
      if (!lastRefreshTime) {
        lastRefreshTime = new Date();
        if (typeof window !== 'undefined') {
          localStorage.setItem('calendar-last-refresh-time', lastRefreshTime.toISOString());
        }
      }
      
      // Load manually collapsed projects from localStorage
      const manuallyCollapsed = new Set<string>();
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('calendar-manually-collapsed-projects');
        if (saved) {
          try {
            const projectIds = JSON.parse(saved);
            projectIds.forEach((id: string) => manuallyCollapsed.add(id));
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
      
      // Fetch comments for all projects
      const commentPromises = projects.map(async (project) => {
        try {
          const response = await fetch(`/api/comments?entityType=project&entityId=${project._id.toString()}`);
          if (response.ok) {
            const comments = await response.json();
            // Flatten comments and replies to get all comment timestamps
            const getAllCommentTimestamps = (commentList: any[]): Date[] => {
              const timestamps: Date[] = [];
              commentList.forEach((comment) => {
                if (comment.createdAt) timestamps.push(new Date(comment.createdAt));
                if (comment.updatedAt) timestamps.push(new Date(comment.updatedAt));
                if (comment.replies && comment.replies.length > 0) {
                  timestamps.push(...getAllCommentTimestamps(comment.replies));
                }
              });
              return timestamps;
            };
            
            const timestamps = getAllCommentTimestamps(comments);
            const projectId = project._id.toString();
            let latestUpdateTime: Date | null = null;
            
            if (timestamps.length > 0) {
              const latestComment = new Date(Math.max(...timestamps.map(t => t.getTime())));
              commentMap.set(projectId, latestComment);
              latestUpdateTime = latestComment;
            }
            
            // Also check project.updatedAt
            const projectUpdatedAt = new Date((project as any).updatedAt || project.createdAt);
            if (!latestUpdateTime || projectUpdatedAt > latestUpdateTime) {
              latestUpdateTime = projectUpdatedAt;
            }
            
            // Only auto-expand if project was updated AFTER last refresh AND hasn't been manually collapsed
            if (latestUpdateTime && latestUpdateTime > lastRefreshTime && !manuallyCollapsed.has(projectId)) {
              setExpandedProjects(prev => new Set(prev).add(projectId));
            }
          }
        } catch (error) {
          // Error fetching comments for project
        }
      });
      
      await Promise.all(commentPromises);
      setProjectLatestComments(commentMap);
      
      // Update last refresh time to now
      if (typeof window !== 'undefined') {
        localStorage.setItem('calendar-last-refresh-time', new Date().toISOString());
      }
    };
    
    if (projects.length > 0) {
      fetchLatestComments();
    }
  }, [projects]);

  // Helper function to get employee name from ID or return the name if available
  const getEmployeeName = (assignedToId: string | undefined, assignedToName: string | undefined): string | undefined => {
    if (assignedToName) return assignedToName;
    if (assignedToId) {
      const employee = employees.find(emp => emp._id?.toString() === assignedToId);
      return employee?.name;
    }
    return undefined;
  };

  // Helper function to get latest update time for a project
  const getProjectLatestUpdate = (project: IProject): Date => {
    const projectId = project._id.toString();
    const projectUpdatedAt = new Date((project as any).updatedAt || project.createdAt);
    const latestComment = projectLatestComments.get(projectId);
    
    if (latestComment) {
      return latestComment > projectUpdatedAt ? latestComment : projectUpdatedAt;
    }
    return projectUpdatedAt;
  };

  // Sort projects by latest update time (newest first)
  const sortProjectsByLatestUpdate = (projectList: IProject[]): IProject[] => {
    return [...projectList].sort((a, b) => {
      const aUpdate = getProjectLatestUpdate(a);
      const bUpdate = getProjectLatestUpdate(b);
      return bUpdate.getTime() - aUpdate.getTime();
    });
  };

  const toggleProjectExpanded = (projectId: string) => {
    setExpandedProjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
        // Track manually collapsed projects
        if (typeof window !== 'undefined') {
          const saved = localStorage.getItem('calendar-manually-collapsed-projects');
          const manuallyCollapsed = saved ? new Set(JSON.parse(saved)) : new Set<string>();
          manuallyCollapsed.add(projectId);
          localStorage.setItem('calendar-manually-collapsed-projects', JSON.stringify(Array.from(manuallyCollapsed)));
        }
      } else {
        newSet.add(projectId);
        // Remove from manually collapsed if it was there
        if (typeof window !== 'undefined') {
          const saved = localStorage.getItem('calendar-manually-collapsed-projects');
          if (saved) {
            const manuallyCollapsed = new Set(JSON.parse(saved));
            manuallyCollapsed.delete(projectId);
            localStorage.setItem('calendar-manually-collapsed-projects', JSON.stringify(Array.from(manuallyCollapsed)));
          }
        }
      }
      return newSet;
    });
  };

  useEffect(() => {
    setViewDate(currentDate);
  }, [currentDate, timeframe]);

  // Generate recurring instances of operations for the current view
  const operationInstances = useMemo(() => {
    const range = getTimeframeRange(timeframe, viewDate);
    const viewStart = new Date(range.start);
    viewStart.setHours(0, 0, 0, 0);
    const viewEnd = new Date(range.end);
    viewEnd.setHours(23, 59, 59, 999);
    
    const instances: Array<{ operation: IOperation; startDate: Date; endDate: Date }> = [];
    
    // Filter out operations that are linked to projects - they should only show inside their project
    const standaloneOperations = operations.filter((operation) => !operation.projectId);
    
    standaloneOperations.forEach((operation) => {
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
      // For none: show operation only once if it falls within the view range
      else if (operation.recurrenceType === 'none') {
        const instanceStart = new Date(operationStart);
        instanceStart.setHours(0, 0, 0, 0);
        let instanceEnd: Date;
        if (operation.endDate) {
          // Use the operation's actual endDate
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
  }, [operations, timeframe, viewDate]);

  const handleDateChange = (newDate: Date) => {
    setViewDate(newDate);
    if (onDateChange) {
      onDateChange(newDate);
    }
  };

  // Get date range based on timeframe
  const getDateRange = () => {
    const range = getTimeframeRange(timeframe, viewDate);
    return { start: new Date(range.start), end: new Date(range.end) };
  };

  const { start: startDate, end: endDate } = getDateRange();

  // Helper function to calculate project hours by summing tasks/operations' estimatedHours
  // Excludes completed items for consistency
  const getProjectEstimatedHours = (project: IProject): number => {
    // For launched projects, sum operations' estimatedHours
    if (project.status === 'launched') {
      const projectOperations = operations.filter((op) => 
        op.projectId?.toString() === project._id.toString() && 
        op.status !== 'complete' // Exclude completed operations
      );
      
      const totalOperationHours = projectOperations.reduce((sum, op) => {
        if (op.estimatedHours !== undefined && op.estimatedHours !== null) {
          const hours = typeof op.estimatedHours === 'number' 
            ? op.estimatedHours 
            : parseFloat(op.estimatedHours);
          return sum + (isNaN(hours) ? 0 : hours);
        }
        return sum;
      }, 0);
      
      // Round to 1 decimal place for consistency
      return Math.round(totalOperationHours * 100) / 100;
    }
    
    // For non-launched projects, sum tasks' estimatedHours (excluding completed tasks)
    if (project.tasks && project.tasks.length > 0) {
      const totalTaskHours = project.tasks.reduce((sum, task) => {
        if (task.status !== 'complete' && task.estimatedHours !== undefined && task.estimatedHours !== null) {
          const hours = typeof task.estimatedHours === 'number' 
            ? task.estimatedHours 
            : parseFloat(task.estimatedHours);
          return sum + (isNaN(hours) ? 0 : hours);
        }
        return sum;
      }, 0);
      
      // Round to 1 decimal place for consistency
      return Math.round(totalTaskHours * 100) / 100;
    }
    
    // If no tasks, return 0 (or project.estimatedHours if you want to keep that as fallback)
    return 0;
  };

  const navigatePeriod = (direction: 'prev' | 'next') => {
    const newDate = new Date(viewDate);
    switch (timeframe) {
      case 'today':
        newDate.setDate(newDate.getDate() + (direction === 'prev' ? -1 : 1));
        break;
      case 'weekly':
        newDate.setDate(newDate.getDate() + (direction === 'prev' ? -7 : 7));
        break;
      case 'monthly':
        newDate.setMonth(newDate.getMonth() + (direction === 'prev' ? -1 : 1));
        break;
      case 'quarterly':
        newDate.setMonth(newDate.getMonth() + (direction === 'prev' ? -3 : 3));
        break;
      case 'yearly':
        newDate.setFullYear(newDate.getFullYear() + (direction === 'prev' ? -1 : 1));
        break;
    }
    handleDateChange(newDate);
  };

  const goToToday = () => {
    const today = new Date();
    handleDateChange(today);
  };

  const getProjectsForDay = (day: Date) => {
    return projects.filter((project) => {
      // Parse dates to avoid timezone issues - extract YYYY-MM-DD and create local date
      const startDateObj = new Date(project.startDate);
      const startDateStr = startDateObj.toISOString().split('T')[0];
      const [startYear, startMonth, startDay] = startDateStr.split('-').map(Number);
      const projectStart = new Date(startYear, startMonth - 1, startDay);
      projectStart.setHours(0, 0, 0, 0);
      
      const endDateObj = new Date(project.endDate);
      const endDateStr = endDateObj.toISOString().split('T')[0];
      const [endYear, endMonth, endDay] = endDateStr.split('-').map(Number);
      const projectEnd = new Date(endYear, endMonth - 1, endDay);
      projectEnd.setHours(23, 59, 59, 999);
      
      const dayStart = new Date(day);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(day);
      dayEnd.setHours(23, 59, 59, 999);
      
      return projectStart <= dayEnd && projectEnd >= dayStart;
    });
  };

  const getOperationInstancesForDay = (day: Date) => {
    return operationInstances.filter((instance) => {
      const dayStart = new Date(day);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(day);
      dayEnd.setHours(23, 59, 59, 999);
      
      return instance.startDate <= dayEnd && instance.endDate >= dayStart;
    });
  };

  const isToday = (day: Date) => {
    const today = new Date();
    return day.toDateString() === today.toDateString();
  };

  const isInViewRange = (day: Date) => {
    return day >= startDate && day <= endDate;
  };

  const getViewTitle = () => {
    switch (timeframe) {
      case 'today':
        const today = new Date(startDate);
        const dayName = today.toLocaleDateString('en-US', { weekday: 'long' });
        const dateStr = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        return `${dayName}, ${dateStr}`;
      case 'weekly':
        return `${formatDate(startDate)} - ${formatDate(endDate)}`;
      case 'monthly':
        return viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      case 'quarterly':
        const quarter = Math.floor(viewDate.getMonth() / 3) + 1;
        return `Q${quarter} ${viewDate.getFullYear()}`;
      case 'yearly':
        return viewDate.getFullYear().toString();
      default:
        return viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
  };

  // Today View - One huge box showing everything for today
  const renderTodayView = () => {
    const today = new Date(startDate);
    const todayProjects = sortProjectsByLatestUpdate(getProjectsForDay(today));
    const todayOperations = getOperationInstancesForDay(today);

    return (
      <div className="p-8 min-h-[600px]">

        {todayProjects.length === 0 && todayOperations.length === 0 ? (
          <div className="text-center py-16 text-text-secondary">
            <p className="text-lg mb-2">No projects or operations scheduled for today</p>
            <p className="text-sm">Create a project or operation to get started!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {todayOperations.length > 0 && (
              <>
                <h3 className="text-xl font-semibold text-text-primary mb-4">
                  Operations ({todayOperations.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {todayOperations.map((instance, idx) => {
                    const totalDays = Math.ceil((instance.endDate.getTime() - instance.startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                    const operation = instance.operation;
                    const color = operation.status === 'in-review' ? '#FFAB00' : '#9ca3af'; // Warning for in-review, light grey for others

                    return (
                      <div
                        key={`operation-${operation._id.toString()}-${idx}`}
                        onClick={() => onOperationClick(operation)}
                        className="p-6 rounded-lg cursor-pointer hover:opacity-90 transition-opacity border-2 border-border"
                        style={{
                          backgroundColor: color + '20',
                          borderColor: color,
                        }}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <h4 className={`text-xl font-bold text-text-primary ${operation.status === 'complete' ? 'line-through' : ''}`} style={{ color: color }}>
                            {operation.name}
                          </h4>
                          <span
                            className="px-3 py-1 rounded-full text-sm font-medium text-white"
                            style={{ backgroundColor: color }}
                          >
                            {operation.status}
                          </span>
                        </div>
                        
                        {operation.description && (
                          <p className="text-text-secondary mb-3">{operation.description}</p>
                        )}

                        <div className="space-y-2">
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-text-secondary">
                              <strong>Recurrence:</strong> {operation.recurrenceType === 'none' ? 'Non Recurring' : operation.recurrenceType}
                            </span>
                            <span className="text-text-secondary">
                              <strong>Dates:</strong> {formatDate(instance.startDate)} - {formatDate(instance.endDate)}
                            </span>
                          </div>
                          
                          {operation.estimatedHours && (
                            <div className="text-sm text-text-secondary">
                              <strong>Estimated Hours:</strong> {operation.estimatedHours}h
                            </div>
                          )}
                          
                          {getEmployeeName((operation as any).assignedToEmployeeId?.toString(), operation.assignedTo) && (
                            <div className="text-sm text-text-secondary">
                              <strong>Assigned To:</strong> {getEmployeeName((operation as any).assignedToEmployeeId?.toString(), operation.assignedTo)}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            {todayProjects.length > 0 && (
              <>
                <h3 className="text-xl font-semibold text-text-primary mb-4">
                  Projects ({todayProjects.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {todayProjects.map((project) => {
                // Parse dates to avoid timezone issues - extract YYYY-MM-DD and create local date
                const startDateObj = new Date(project.startDate);
                const startDateStr = startDateObj.toISOString().split('T')[0];
                const [startYear, startMonth, startDay] = startDateStr.split('-').map(Number);
                const projectStart = new Date(startYear, startMonth - 1, startDay);
                projectStart.setHours(0, 0, 0, 0);
                
                const endDateObj = new Date(project.endDate);
                const endDateStr = endDateObj.toISOString().split('T')[0];
                const [endYear, endMonth, endDay] = endDateStr.split('-').map(Number);
                const projectEnd = new Date(endYear, endMonth - 1, endDay);
                projectEnd.setHours(23, 59, 59, 999);
                
                const totalDays = Math.ceil((projectEnd.getTime() - projectStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                const displayColor = project.status === 'in-review' ? '#ef4444' : project.color; // Red for in-review
                const projectId = project._id.toString();
                const isExpanded = expandedProjects.has(projectId);
                const hasTasks = project.tasks && project.tasks.length > 0 && project.status !== 'launched';
                const hasOperations = project.status === 'launched' && operations.some((op) => 
                  op.projectId?.toString() === project._id.toString() && op.startDate
                );

                return (
                  <div
                    key={projectId}
                    className="p-6 rounded-lg border-2 border-border"
                    style={{
                      backgroundColor: displayColor + '20',
                      borderColor: displayColor,
                    }}
                  >
                    <div 
                      className="flex items-start justify-between cursor-pointer"
                      onClick={() => onProjectClick(project)}
                    >
                      <h4 className={`text-xl font-bold text-text-primary ${project.status === 'completed' ? 'line-through opacity-60' : ''}`} style={{ color: displayColor }}>
                        {project.name}
                      </h4>
                      <div className="flex items-center gap-2">
                        <span
                          className="px-3 py-1 rounded-full text-sm font-medium text-white"
                          style={{ backgroundColor: displayColor }}
                        >
                          {project.status}
                        </span>
                        {(hasTasks || hasOperations) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleProjectExpanded(projectId);
                            }}
                            className="text-text-secondary hover:text-text-primary transition-colors"
                            aria-label={isExpanded ? 'Collapse' : 'Expand'}
                          >
                            {isExpanded ? '▼' : '▶'}
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {isExpanded && (
                      <>
                        {project.description && (
                          <p className="text-text-secondary mb-3 mt-3">{project.description}</p>
                        )}

                        <div className="space-y-2 mt-3">
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-text-secondary">
                              <strong>Duration:</strong> {formatDate(projectStart)} - {formatDate(projectEnd)} ({totalDays} {totalDays === 1 ? 'day' : 'days'})
                            </span>
                          </div>
                          
                          <div className="text-sm text-text-secondary">
                            <strong>Estimated Hours:</strong> {getProjectEstimatedHours(project)}h
                          </div>
                          
                          {getEmployeeName((project as any).assignedToEmployeeId?.toString(), project.assignedTo) && (
                            <div className="text-sm text-text-secondary">
                              <strong>Assigned To:</strong> {getEmployeeName((project as any).assignedToEmployeeId?.toString(), project.assignedTo)}
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {/* Show tasks for non-launched projects */}
                    {hasTasks && (
                      <div className="mt-4">
                        <p className="text-sm font-semibold text-text-primary mb-2">Tasks:</p>
                        {isExpanded ? (
                          <div className="space-y-2">
                            {/* Show all tasks for managers/admins, or tasks assigned to current user for regular users */}
                            {project.tasks!
                              .filter((task) => {
                                // If user is manager/admin, show all tasks
                                if (isManagerOrAdmin) {
                                  return true;
                                }
                                // If currentUserEmployeeName is set, only show tasks assigned to that user
                                // Check by employeeId (preferred) or name (legacy)
                                if (currentUserEmployeeName) {
                                  const taskAssignedToId = (task as any).assignedToEmployeeId?.toString();
                                  // Note: We'd need currentUserEmployeeId passed as prop to check by ID
                                  // For now, check by name for backward compatibility
                                  return task.assignedTo === currentUserEmployeeName;
                                }
                                // Otherwise show all tasks
                                return true;
                              })
                              .map((task, idx) => {
                                // Normalize dates to midnight for accurate date-only comparison
                                const taskStart = new Date(task.startDate);
                                taskStart.setHours(0, 0, 0, 0);
                                const taskEnd = new Date(task.endDate);
                                taskEnd.setHours(23, 59, 59, 999); // End of day
                                
                                const todayNormalized = new Date(today);
                                todayNormalized.setHours(0, 0, 0, 0);
                                
                                const taskDays = Math.ceil((taskEnd.getTime() - taskStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                                const isTodayInTask = todayNormalized >= taskStart && todayNormalized <= taskEnd;

                                // Show task if it includes today OR if user is manager/admin OR if it's assigned to the current user
                                // Check assignment by employeeId (preferred) or name (legacy)
                                const taskAssignedToId = (task as any).assignedToEmployeeId?.toString();
                                const isAssignedToUser = currentUserEmployeeName && (
                                  taskAssignedToId === currentUserEmployeeId || 
                                  task.assignedTo === currentUserEmployeeName
                                );
                                if (!isTodayInTask && !isManagerOrAdmin && !isAssignedToUser) return null;

                                // Use a stable key based on task name, dates, and index to ensure uniqueness
                                // This prevents issues when tasks have the same name and dates
                                const taskKey = `${project._id.toString()}-task-${idx}-${task.name}-${taskStart.getTime()}-${taskEnd.getTime()}`;

                                return (
                                  <div
                                    key={taskKey}
                                    className="p-3 rounded border border-border bg-background-card"
                                  >
                                    <div className="font-medium text-text-primary">{task.name}</div>
                                    {task.description && (
                                      <p className="text-sm text-text-secondary mt-1">{task.description}</p>
                                    )}
                                    <div className="flex gap-4 mt-2 text-xs text-text-secondary">
                                      {task.estimatedHours && <span>{task.estimatedHours}h</span>}
                                      {getEmployeeName((task as any).assignedToEmployeeId?.toString(), task.assignedTo) && (
                                        <span>Assigned: {getEmployeeName((task as any).assignedToEmployeeId?.toString(), task.assignedTo)}</span>
                                      )}
                                      <span className="capitalize">{task.status}</span>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {project.tasks!
                              .filter((task) => {
                                if (isManagerOrAdmin) return true;
                                if (currentUserEmployeeName) {
                                  const taskAssignedToId = (task as any).assignedToEmployeeId?.toString();
                                  return taskAssignedToId === currentUserEmployeeId || task.assignedTo === currentUserEmployeeName;
                                }
                                return true;
                              })
                              .map((task, idx) => {
                                const taskStart = new Date(task.startDate);
                                taskStart.setHours(0, 0, 0, 0);
                                const taskEnd = new Date(task.endDate);
                                taskEnd.setHours(23, 59, 59, 999);
                                const todayNormalized = new Date(today);
                                todayNormalized.setHours(0, 0, 0, 0);
                                const isTodayInTask = todayNormalized >= taskStart && todayNormalized <= taskEnd;
                                const taskAssignedToId = (task as any).assignedToEmployeeId?.toString();
                                const isAssignedToUser = currentUserEmployeeName && (
                                  taskAssignedToId === currentUserEmployeeId || 
                                  task.assignedTo === currentUserEmployeeName
                                );
                                if (!isTodayInTask && !isManagerOrAdmin && !isAssignedToUser) return null;
                                return (
                                  <div key={`${project._id.toString()}-task-${idx}`} className="text-sm text-text-secondary">
                                    {task.name}
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Show operations for launched projects */}
                    {hasOperations && (() => {
                      const projectOperations = operations.filter((op) => 
                        op.projectId?.toString() === project._id.toString() && op.startDate
                      );
                      
                      const todayOperations = projectOperations.filter((op) => {
                        const opStart = new Date(op.startDate!);
                        opStart.setHours(0, 0, 0, 0);
                        const opEnd = op.endDate ? new Date(op.endDate) : new Date(opStart);
                        opEnd.setHours(23, 59, 59, 999);
                        
                        const todayNormalized = new Date(today);
                        todayNormalized.setHours(0, 0, 0, 0);
                        
                        return todayNormalized >= opStart && todayNormalized <= opEnd;
                      });

                      if (todayOperations.length === 0) return null;

                      return (
                        <div className="mt-4">
                          <p className="text-sm font-semibold text-text-primary mb-2">Operations:</p>
                          {isExpanded ? (
                            <div className="space-y-2">
                              {todayOperations.map((operation) => {
                                const opStart = new Date(operation.startDate!);
                                opStart.setHours(0, 0, 0, 0);
                                const opEnd = operation.endDate ? new Date(operation.endDate) : new Date(opStart);
                                opEnd.setHours(23, 59, 59, 999);
                                
                                const operationKey = `${project._id.toString()}-${operation._id.toString()}-${opStart.getTime()}-${opEnd.getTime()}`;

                                return (
                                  <div
                                    key={operationKey}
                                    className="p-3 rounded border border-border bg-background-card"
                                  >
                                    <div className="font-medium text-text-primary">{operation.name}</div>
                                    {operation.description && (
                                      <p className="text-sm text-text-secondary mt-1">{operation.description}</p>
                                    )}
                                    <div className="flex gap-4 mt-2 text-xs text-text-secondary">
                                      {operation.estimatedHours && <span>{operation.estimatedHours}h</span>}
                                      {getEmployeeName((operation as any).assignedToEmployeeId?.toString(), operation.assignedTo) && (
                                        <span>Assigned: {getEmployeeName((operation as any).assignedToEmployeeId?.toString(), operation.assignedTo)}</span>
                                      )}
                                      <span className="capitalize">{operation.status}</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="space-y-1">
                              {todayOperations.map((operation) => (
                                <div key={`${project._id.toString()}-operation-${operation._id.toString()}`} className="text-sm text-text-secondary">
                                  {operation.name}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  // Weekly View - Large daily boxes spanning 3 rows
  const renderWeeklyView = () => {
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const days: Date[] = [];
    const current = new Date(startDate);
    
    for (let i = 0; i < 7; i++) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return (
      <>
        <div className="grid grid-cols-7 border-b border-border">
          {dayNames.map((day) => (
            <div
              key={day}
              className="p-3 text-center text-sm font-semibold text-text-secondary bg-background"
            >
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 divide-x divide-border relative">
          {days.map((day, dayIdx) => {
            const isCurrentDay = isToday(day);

            return (
              <div
                key={dayIdx}
                className={`p-4 min-h-[360px] relative ${isCurrentDay ? 'bg-primary-light' : ''}`}
              >
                <div
                  className={`text-lg font-semibold mb-3 ${
                    isCurrentDay ? 'text-primary' : 'text-text-primary'
                  }`}
                >
                  {day.getDate()}
                </div>
                <div className="space-y-2 relative" style={{ minHeight: '300px' }}>
                  {/* Projects will be rendered as absolute positioned elements */}
                </div>
              </div>
            );
          })}
          {/* Render operations and projects spanning across days */}
          {(() => {
            // Get all unique operation instances for this week
            const weekOperationInstances = new Map<string, typeof operationInstances[0]>();
            days.forEach(day => {
              getOperationInstancesForDay(day).forEach(instance => {
                weekOperationInstances.set(`${instance.operation._id.toString()}-${instance.startDate.getTime()}`, instance);
              });
            });

            // Get all unique projects for this week
            const weekProjects = new Map<string, IProject>();
            days.forEach(day => {
              getProjectsForDay(day).forEach(project => {
                weekProjects.set(project._id.toString(), project);
              });
            });

            // Combine operations and projects - operations first
            const allItems: Array<{ type: 'operation' | 'project'; operation?: typeof operationInstances[0]; project?: IProject; startDate: Date; endDate: Date }> = [];
            
            // Add operations first
            Array.from(weekOperationInstances.values()).forEach(instance => {
              allItems.push({
                type: 'operation',
                operation: instance,
                startDate: instance.startDate,
                endDate: instance.endDate,
              });
            });
            
            // Add projects (sorted by latest update)
            sortProjectsByLatestUpdate(Array.from(weekProjects.values())).forEach(project => {
              // Parse dates to avoid timezone issues - extract YYYY-MM-DD and create local date
              const startDateObj = new Date(project.startDate);
              const startDateStr = startDateObj.toISOString().split('T')[0];
              const [startYear, startMonth, startDay] = startDateStr.split('-').map(Number);
              const projectStart = new Date(startYear, startMonth - 1, startDay);
              projectStart.setHours(0, 0, 0, 0);
              
              const endDateObj = new Date(project.endDate);
              const endDateStr = endDateObj.toISOString().split('T')[0];
              const [endYear, endMonth, endDay] = endDateStr.split('-').map(Number);
              const projectEnd = new Date(endYear, endMonth - 1, endDay);
              projectEnd.setHours(23, 59, 59, 999);
              
              allItems.push({
                type: 'project',
                project: project,
                startDate: projectStart,
                endDate: projectEnd,
              });
            });
            
            // Calculate positions for each item with stacking
            const itemPositions = allItems.map((item) => {
              const itemStart = item.startDate;
              const itemEnd = item.endDate;
              
              // Find the first day in the week that overlaps with the item
              const weekStart = new Date(days[0]);
              weekStart.setHours(0, 0, 0, 0);
              const weekEnd = new Date(days[6]);
              weekEnd.setHours(23, 59, 59, 999);
              
              // Item start is either the item's actual start or the week start, whichever is later
              const displayStart = itemStart < weekStart ? weekStart : itemStart;
              // Item end is either the item's actual end or the week end, whichever is earlier
              const displayEnd = itemEnd > weekEnd ? weekEnd : itemEnd;

              // Find start column (which day of the week)
              const startCol = days.findIndex(d => {
                const dayStart = new Date(d);
                dayStart.setHours(0, 0, 0, 0);
                const dayEnd = new Date(d);
                dayEnd.setHours(23, 59, 59, 999);
                return displayStart >= dayStart && displayStart <= dayEnd;
              });
              
              if (startCol === -1) return null;

              // Calculate span in days
              // Normalize dates to midnight for accurate day-only comparison
              const startDayNormalized = new Date(displayStart);
              startDayNormalized.setHours(0, 0, 0, 0);
              const endDayNormalized = new Date(displayEnd);
              endDayNormalized.setHours(0, 0, 0, 0);
              const startDay = startDayNormalized.toDateString();
              const endDay = endDayNormalized.toDateString();
              // For inclusive dates: Jan 19 to Jan 20 = 2 days (19th and 20th)
              const daysSpan = startDay === endDay ? 1 : Math.floor((endDayNormalized.getTime() - startDayNormalized.getTime()) / (1000 * 60 * 60 * 24)) + 1;
              const span = Math.min(daysSpan, 7 - startCol);

              return {
                ...item,
                startCol,
                span,
                displayStart,
                displayEnd,
              };
            }).filter((pos): pos is NonNullable<typeof pos> => pos !== null);

            // Calculate vertical stacking positions
            const stackPositions: number[] = new Array(itemPositions.length).fill(0);
            const rowHeight = 24; // Height of each row in pixels
            const baseTop = 60; // Base top position

            for (let i = 0; i < itemPositions.length; i++) {
              const current = itemPositions[i];
              let stackLevel = 0;
              
              // Check all previous items to see if they overlap
              for (let j = 0; j < i; j++) {
                const previous = itemPositions[j];
                // Check if items overlap in time
                if (current.displayStart <= previous.displayEnd && current.displayEnd >= previous.displayStart) {
                  // They overlap, so this item needs to be on a higher stack level
                  stackLevel = Math.max(stackLevel, stackPositions[j] + 1);
                }
              }
              
              stackPositions[i] = stackLevel;
            }

            return itemPositions.map((pos, idx) => {
              const topPosition = baseTop + (stackPositions[idx] * rowHeight);
              const isOperation = pos.type === 'operation';
              const status = isOperation ? pos.operation!.operation.status : pos.project!.status;
              const baseColor = isOperation ? '#9ca3af' : (pos.project?.color || '#3b82f6');
              const color = status === 'in-review' ? '#ef4444' : baseColor; // Red for in-review
              const name = isOperation ? pos.operation!.operation.name : pos.project!.name;
              const estimatedHours = isOperation ? pos.operation!.operation.estimatedHours : getProjectEstimatedHours(pos.project!);
              const assignedToId = isOperation 
                ? (pos.operation!.operation as any).assignedToEmployeeId?.toString()
                : (pos.project! as any).assignedToEmployeeId?.toString();
              const assignedToName = isOperation ? pos.operation!.operation.assignedTo : pos.project!.assignedTo;
              const assignedTo = getEmployeeName(assignedToId, assignedToName);
              
              // Calculate duration for operations
              let durationText = '';
              if (isOperation) {
                const opDuration = Math.ceil((pos.operation!.endDate.getTime() - pos.operation!.startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                if (opDuration > 1) {
                  durationText = ` - ${opDuration} day${opDuration !== 1 ? 's' : ''}`;
                }
              }
              
              return (
                <div
                  key={isOperation ? `operation-${pos.operation!.operation._id.toString()}-${pos.operation!.startDate.getTime()}-weekly` : `${pos.project!._id.toString()}-weekly`}
                  onClick={() => isOperation ? onOperationClick(pos.operation!.operation) : onProjectClick(pos.project!)}
                  className={`absolute text-xs px-2 py-1 rounded cursor-pointer hover:opacity-80 z-10 ${(isOperation ? status === 'complete' : status === 'completed') ? 'line-through opacity-60' : ''}`}
                  style={{
                    backgroundColor: color,
                    color: 'white',
                    left: `calc(${pos.startCol * (100 / 7)}% + ${pos.startCol * 1}px)`,
                    width: `calc(${pos.span * (100 / 7)}% - ${pos.span * 1}px)`,
                    top: `${topPosition}px`,
                    height: `${rowHeight - 2}px`,
                    overflow: 'hidden',
                    lineHeight: `${rowHeight - 4}px`,
                  }}
                  title={`${name}${durationText}${estimatedHours ? ` - ${estimatedHours}h` : ''}${assignedTo ? ` - ${assignedTo}` : ''}`}
                >
                  <div className="font-medium truncate">{name}</div>
                </div>
              );
            });
          })()}
        </div>
      </>
    );
  };

  // Monthly View - Standard calendar grid with slightly larger boxes
  const renderMonthlyView = () => {
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    
    // Get first day of month and adjust to Monday
    const firstDayOfMonth = new Date(startDate);
    const firstDay = firstDayOfMonth.getDay();
    const mondayOffset = firstDay === 0 ? 6 : firstDay - 1;
    const calendarStart = new Date(firstDayOfMonth);
    calendarStart.setDate(calendarStart.getDate() - mondayOffset);

    // Get last day of month and adjust to Sunday
    const lastDayOfMonth = new Date(endDate);
    const lastDay = lastDayOfMonth.getDay();
    const sundayOffset = lastDay === 0 ? 0 : 7 - lastDay;
    const calendarEnd = new Date(lastDayOfMonth);
    calendarEnd.setDate(calendarEnd.getDate() + sundayOffset);

    const days: Date[] = [];
    const current = new Date(calendarStart);
    while (current <= calendarEnd) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    const weeks: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }

    return (
      <>
        <div className="grid grid-cols-7 border-b border-border">
          {dayNames.map((day) => (
            <div
              key={day}
              className="p-2 text-center text-sm font-semibold text-text-secondary bg-background"
            >
              {day}
            </div>
          ))}
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-700 relative">
          {weeks.map((week, weekIdx) => (
            <div key={weekIdx} className="grid grid-cols-7 divide-x divide-gray-200 dark:divide-gray-700 min-h-[200px] relative">
              {week.map((day, dayIdx) => {
                const isCurrentDay = isToday(day);
                const inViewRange = isInViewRange(day);

                return (
                  <div
                    key={dayIdx}
                    className={`p-2 relative ${!inViewRange ? 'bg-background opacity-50' : ''} ${
                      isCurrentDay ? 'bg-primary-light' : ''
                    }`}
                  >
                    <div
                      className={`text-sm font-medium mb-1 ${
                        isCurrentDay ? 'text-primary' : 'text-text-primary'
                      }`}
                    >
                      {day.getDate()}
                    </div>
                    {/* Project slots - projects will be rendered as absolute positioned elements */}
                    <div className="space-y-1 min-h-[170px]" style={{ position: 'relative' }}>
                      {/* Projects will be rendered here */}
                    </div>
                  </div>
                );
              })}
              {/* Render operations and projects that span across days */}
              {(() => {
                // Get all unique operation instances for this week
                const weekOperationInstances = new Map<string, typeof operationInstances[0]>();
                week.forEach(day => {
                  getOperationInstancesForDay(day).forEach(instance => {
                    weekOperationInstances.set(`${instance.operation._id.toString()}-${instance.startDate.getTime()}`, instance);
                  });
                });

                // Get all unique projects for this week
                const weekProjects = new Map<string, IProject>();
                week.forEach(day => {
                  getProjectsForDay(day).forEach(project => {
                    weekProjects.set(project._id.toString(), project);
                  });
                });

                // Combine operations and projects - operations first
                const allItems: Array<{ type: 'operation' | 'project'; operation?: typeof operationInstances[0]; project?: IProject; startDate: Date; endDate: Date }> = [];
                
                // Add operations first
                Array.from(weekOperationInstances.values()).forEach(instance => {
                  allItems.push({
                    type: 'operation',
                    operation: instance,
                    startDate: instance.startDate,
                    endDate: instance.endDate,
                  });
                });
                
                // Add projects
                Array.from(weekProjects.values()).forEach(project => {
                  // Parse dates to avoid timezone issues - extract YYYY-MM-DD and create local date
                  const startDateObj = new Date(project.startDate);
                  const startDateStr = startDateObj.toISOString().split('T')[0];
                  const [startYear, startMonth, startDay] = startDateStr.split('-').map(Number);
                  const projectStart = new Date(startYear, startMonth - 1, startDay);
                  projectStart.setHours(0, 0, 0, 0);
                  
                  const endDateObj = new Date(project.endDate);
                  const endDateStr = endDateObj.toISOString().split('T')[0];
                  const [endYear, endMonth, endDay] = endDateStr.split('-').map(Number);
                  const projectEnd = new Date(endYear, endMonth - 1, endDay);
                  projectEnd.setHours(23, 59, 59, 999);
                  
                  allItems.push({
                    type: 'project',
                    project: project,
                    startDate: projectStart,
                    endDate: projectEnd,
                  });
                });
                
                // Calculate positions for each item with stacking
                const itemPositions = allItems.map((item) => {
                  const itemStart = item.startDate;
                  const itemEnd = item.endDate;
                  
                  // Find the first day in the week that overlaps with the item
                  const weekStart = new Date(week[0]);
                  weekStart.setHours(0, 0, 0, 0);
                  const weekEnd = new Date(week[6]);
                  weekEnd.setHours(23, 59, 59, 999);
                  
                  // Item start is either the item's actual start or the week start, whichever is later
                  const displayStart = itemStart < weekStart ? weekStart : itemStart;
                  // Item end is either the item's actual end or the week end, whichever is earlier
                  const displayEnd = itemEnd > weekEnd ? weekEnd : itemEnd;

                  // Find the start column in this week
                  const startCol = week.findIndex(d => {
                    const dayStart = new Date(d);
                    dayStart.setHours(0, 0, 0, 0);
                    const dayEnd = new Date(d);
                    dayEnd.setHours(23, 59, 59, 999);
                    return displayStart >= dayStart && displayStart <= dayEnd;
                  });
                  
                  if (startCol === -1) return null;

                  // Calculate how many days the item spans in this week
                  // Normalize dates to midnight for accurate day-only comparison
                  const startDayNormalized = new Date(displayStart);
                  startDayNormalized.setHours(0, 0, 0, 0);
                  const endDayNormalized = new Date(displayEnd);
                  endDayNormalized.setHours(0, 0, 0, 0);
                  const startDay = startDayNormalized.toDateString();
                  const endDay = endDayNormalized.toDateString();
                  // For inclusive dates: Jan 19 to Jan 20 = 2 days (19th and 20th)
                  const daysInWeek = startDay === endDay ? 1 : Math.floor((endDayNormalized.getTime() - startDayNormalized.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                  const span = Math.min(daysInWeek, 7 - startCol);

                  return {
                    ...item,
                    startCol,
                    span,
                    displayStart,
                    displayEnd,
                  };
                }).filter((pos): pos is NonNullable<typeof pos> => pos !== null);

                // Calculate vertical stacking positions
                const stackPositions: number[] = new Array(itemPositions.length).fill(0);
                const rowHeight = 20; // Height of each row in pixels
                const baseTop = 24; // Base top position

                for (let i = 0; i < itemPositions.length; i++) {
                  const current = itemPositions[i];
                  let stackLevel = 0;
                  
                  // Check all previous items to see if they overlap
                  for (let j = 0; j < i; j++) {
                    const previous = itemPositions[j];
                    // Check if items overlap in time
                    if (current.displayStart <= previous.displayEnd && current.displayEnd >= previous.displayStart) {
                      // They overlap, so this item needs to be on a higher stack level
                      stackLevel = Math.max(stackLevel, stackPositions[j] + 1);
                    }
                  }
                  
                  stackPositions[i] = stackLevel;
                }

                return itemPositions.map((pos, idx) => {
                  const topPosition = baseTop + (stackPositions[idx] * rowHeight);
                  const isOperation = pos.type === 'operation';
                  const status = isOperation ? pos.operation!.operation.status : pos.project!.status;
                  const baseColor = isOperation ? '#9ca3af' : (pos.project?.color || '#3b82f6');
                  const color = status === 'in-review' ? '#ef4444' : baseColor; // Red for in-review
                  const name = isOperation ? pos.operation!.operation.name : pos.project!.name;
                  const estimatedHours = isOperation ? pos.operation!.operation.estimatedHours : getProjectEstimatedHours(pos.project!);
                  const assignedToId = isOperation 
                    ? (pos.operation!.operation as any).assignedToEmployeeId?.toString()
                    : (pos.project! as any).assignedToEmployeeId?.toString();
                  const assignedToName = isOperation ? pos.operation!.operation.assignedTo : pos.project!.assignedTo;
                  const assignedTo = getEmployeeName(assignedToId, assignedToName);
                  
                  // Calculate duration for operations
                  let durationText = '';
                  if (isOperation) {
                    const opDuration = Math.ceil((pos.operation!.endDate.getTime() - pos.operation!.startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                    if (opDuration > 1) {
                      durationText = ` - ${opDuration} day${opDuration !== 1 ? 's' : ''}`;
                    }
                  }
                  
                  return (
                    <div
                      key={isOperation ? `operation-${pos.operation!.operation._id.toString()}-${pos.operation!.startDate.getTime()}-${weekIdx}` : `${pos.project!._id.toString()}-${weekIdx}`}
                      onClick={() => isOperation ? onOperationClick(pos.operation!.operation) : onProjectClick(pos.project!)}
                      className={`absolute text-xs px-1.5 py-0.5 rounded cursor-pointer hover:opacity-80 z-10 ${(isOperation ? status === 'complete' : status === 'completed') ? 'line-through opacity-60' : ''}`}
                      style={{
                        backgroundColor: color,
                        color: 'white',
                        left: `calc(${pos.startCol * (100 / 7)}% + ${pos.startCol * 1}px)`,
                        width: `calc(${pos.span * (100 / 7)}% - ${pos.span * 1}px)`,
                        top: `${topPosition}px`,
                        height: `${rowHeight - 2}px`,
                        overflow: 'hidden',
                        lineHeight: `${rowHeight - 2}px`,
                      }}
                      title={`${name}${durationText}${estimatedHours ? ` - ${estimatedHours}h` : ''}${assignedTo ? ` - ${assignedTo}` : ''}`}
                    >
                      <div className="font-medium truncate">{name}</div>
                    </div>
                  );
                });
              })()}
            </div>
          ))}
        </div>
      </>
    );
  };

  // Quarterly View - Each month as a large box on its own row
  const renderQuarterlyView = () => {
    const months: Date[][] = [];
    const quarter = Math.floor(viewDate.getMonth() / 3);
    
    for (let i = 0; i < 3; i++) {
      const monthDate = new Date(viewDate.getFullYear(), quarter * 3 + i, 1);
      const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
      months.push([monthStart, monthEnd]);
    }

    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return (
      <div className="space-y-6 p-6">
        {months.map(([monthStart, monthEnd], idx) => {
          const monthProjects = sortProjectsByLatestUpdate(projects.filter((p) => {
            const pStart = new Date(p.startDate);
            const pEnd = new Date(p.endDate);
            return pStart <= monthEnd && pEnd >= monthStart;
          }));

          // Get first day of month and adjust to Monday
          const firstDay = monthStart.getDay();
          const mondayOffset = firstDay === 0 ? 6 : firstDay - 1;
          const calendarStart = new Date(monthStart);
          calendarStart.setDate(calendarStart.getDate() - mondayOffset);

          // Get last day of month and adjust to Sunday
          const lastDay = monthEnd.getDay();
          const sundayOffset = lastDay === 0 ? 0 : 7 - lastDay;
          const calendarEnd = new Date(monthEnd);
          calendarEnd.setDate(calendarEnd.getDate() + sundayOffset);

          const days: Date[] = [];
          const current = new Date(calendarStart);
          while (current <= calendarEnd) {
            days.push(new Date(current));
            current.setDate(current.getDate() + 1);
          }

          const weeks: Date[][] = [];
          for (let i = 0; i < days.length; i += 7) {
            weeks.push(days.slice(i, i + 7));
          }

          return (
            <div
              key={idx}
              className="bg-background rounded-lg border border-border p-6 min-h-[400px]"
            >
              <h3 className="text-xl font-semibold text-text-primary mb-4">
                {monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h3>
              <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700 mb-2">
                {dayNames.map((day) => (
                  <div
                    key={day}
                    className="p-2 text-center text-sm font-semibold text-text-secondary"
                  >
                    {day}
                  </div>
                ))}
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-700 relative">
                {weeks.map((week, weekIdx) => (
                  <div key={weekIdx} className="grid grid-cols-7 divide-x divide-gray-200 dark:divide-gray-700 min-h-[130px] relative">
                    {week.map((day, dayIdx) => {
                      const inMonth = day.getMonth() === monthStart.getMonth();
                      const isCurrentDay = isToday(day);

                      return (
                        <div
                          key={dayIdx}
                          className={`p-2 relative ${!inMonth ? 'bg-background opacity-50' : ''} ${
                            isCurrentDay ? 'bg-primary-light' : ''
                          }`}
                        >
                          <div className={`text-sm font-medium mb-1 ${
                            isCurrentDay ? 'text-primary' : 'text-text-primary'
                          }`}>
                            {day.getDate()}
                          </div>
                          <div className="space-y-1 min-h-[110px]" style={{ position: 'relative' }}>
                            {/* Projects will be rendered as absolute positioned elements */}
                          </div>
                        </div>
                      );
                    })}
                    {/* Render operations and projects spanning across days */}
                    {(() => {
                      // Get all unique operation instances for this week
                      const weekOperationInstances = new Map<string, typeof operationInstances[0]>();
                      week.forEach(day => {
                        getOperationInstancesForDay(day).forEach(instance => {
                          weekOperationInstances.set(`${instance.operation._id.toString()}-${instance.startDate.getTime()}`, instance);
                        });
                      });

                      // Get all unique projects for this week
                      const weekProjects = new Map<string, IProject>();
                      week.forEach(day => {
                        getProjectsForDay(day).forEach(project => {
                          weekProjects.set(project._id.toString(), project);
                        });
                      });

                      // Combine operations and projects - operations first
                      const allItems: Array<{ type: 'operation' | 'project'; operation?: typeof operationInstances[0]; project?: IProject; startDate: Date; endDate: Date }> = [];
                      
                      // Add operations first
                      Array.from(weekOperationInstances.values()).forEach(instance => {
                        allItems.push({
                          type: 'operation',
                          operation: instance,
                          startDate: instance.startDate,
                          endDate: instance.endDate,
                        });
                      });
                      
                      // Add projects
                      Array.from(weekProjects.values()).forEach(project => {
                        // Parse dates to avoid timezone issues - extract YYYY-MM-DD and create local date
                        const startDateObj = new Date(project.startDate);
                        const startDateStr = startDateObj.toISOString().split('T')[0];
                        const [startYear, startMonth, startDay] = startDateStr.split('-').map(Number);
                        const projectStart = new Date(startYear, startMonth - 1, startDay);
                        projectStart.setHours(0, 0, 0, 0);
                        
                        const endDateObj = new Date(project.endDate);
                        const endDateStr = endDateObj.toISOString().split('T')[0];
                        const [endYear, endMonth, endDay] = endDateStr.split('-').map(Number);
                        const projectEnd = new Date(endYear, endMonth - 1, endDay);
                        projectEnd.setHours(23, 59, 59, 999);
                        
                        allItems.push({
                          type: 'project',
                          project: project,
                          startDate: projectStart,
                          endDate: projectEnd,
                        });
                      });
                      
                      // Calculate positions for each item with stacking
                      const itemPositions = allItems.map((item) => {
                        const itemStart = item.startDate;
                        const itemEnd = item.endDate;
                        
                        // Find the first day in the week that overlaps with the item
                        const weekStart = new Date(week[0]);
                        weekStart.setHours(0, 0, 0, 0);
                        const weekEnd = new Date(week[6]);
                        weekEnd.setHours(23, 59, 59, 999);
                        
                        // Item start is either the item's actual start or the week start, whichever is later
                        const displayStart = itemStart < weekStart ? weekStart : itemStart;
                        // Item end is either the item's actual end or the week end, whichever is earlier
                        const displayEnd = itemEnd > weekEnd ? weekEnd : itemEnd;

                        const startCol = week.findIndex(d => {
                          const dayStart = new Date(d);
                          dayStart.setHours(0, 0, 0, 0);
                          const dayEnd = new Date(d);
                          dayEnd.setHours(23, 59, 59, 999);
                          return displayStart >= dayStart && displayStart <= dayEnd;
                        });
                        if (startCol === -1) return null;

                        // Normalize dates to midnight for accurate day-only comparison
                        const startDayNormalized = new Date(displayStart);
                        startDayNormalized.setHours(0, 0, 0, 0);
                        const endDayNormalized = new Date(displayEnd);
                        endDayNormalized.setHours(0, 0, 0, 0);
                        const startDay = startDayNormalized.toDateString();
                        const endDay = endDayNormalized.toDateString();
                        // For inclusive dates: Jan 19 to Jan 20 = 2 days (19th and 20th)
                        const daysInWeek = startDay === endDay ? 1 : Math.floor((endDayNormalized.getTime() - startDayNormalized.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                        const span = Math.min(daysInWeek, 7 - startCol);

                        return {
                          ...item,
                          startCol,
                          span,
                          displayStart,
                          displayEnd,
                        };
                      }).filter((pos): pos is NonNullable<typeof pos> => pos !== null);

                      // Calculate vertical stacking positions
                      const stackPositions: number[] = new Array(itemPositions.length).fill(0);
                      const rowHeight = 18; // Height of each row in pixels
                      const baseTop = 24; // Base top position

                      for (let i = 0; i < itemPositions.length; i++) {
                        const current = itemPositions[i];
                        let stackLevel = 0;
                        
                        // Check all previous items to see if they overlap
                        for (let j = 0; j < i; j++) {
                          const previous = itemPositions[j];
                          // Check if items overlap in time
                          if (current.displayStart <= previous.displayEnd && current.displayEnd >= previous.displayStart) {
                            // They overlap, so this item needs to be on a higher stack level
                            stackLevel = Math.max(stackLevel, stackPositions[j] + 1);
                          }
                        }
                        
                        stackPositions[i] = stackLevel;
                      }

                      return itemPositions.map((pos, posIdx) => {
                        const topPosition = baseTop + (stackPositions[posIdx] * rowHeight);
                        const isOperation = pos.type === 'operation';
                        const status = isOperation ? pos.operation!.operation.status : pos.project!.status;
                        const baseColor = isOperation ? '#9ca3af' : (pos.project?.color || '#3b82f6');
                        const color = status === 'in-review' ? '#ef4444' : baseColor; // Red for in-review
                        const name = isOperation ? pos.operation!.operation.name : pos.project!.name;
                        const estimatedHours = isOperation ? pos.operation!.operation.estimatedHours : getProjectEstimatedHours(pos.project!);
                        const assignedToId = isOperation 
                          ? (pos.operation!.operation as any).assignedToEmployeeId?.toString()
                          : (pos.project! as any).assignedToEmployeeId?.toString();
                        const assignedToName = isOperation ? pos.operation!.operation.assignedTo : pos.project!.assignedTo;
                        const assignedTo = getEmployeeName(assignedToId, assignedToName);
                        
                        // Calculate duration for operations
                        let durationText = '';
                        if (isOperation) {
                          const opDuration = Math.ceil((pos.operation!.endDate.getTime() - pos.operation!.startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                          if (opDuration > 1) {
                            durationText = ` - ${opDuration} day${opDuration !== 1 ? 's' : ''}`;
                          }
                        }
                        
                        return (
                          <div
                            key={isOperation ? `operation-${pos.operation!.operation._id.toString()}-${pos.operation!.startDate.getTime()}-q${idx}-w${weekIdx}` : `${pos.project!._id.toString()}-q${idx}-w${weekIdx}`}
                            onClick={() => isOperation ? onOperationClick(pos.operation!.operation) : onProjectClick(pos.project!)}
                            className={`absolute text-xs px-1 py-0.5 rounded cursor-pointer hover:opacity-80 z-10 ${(isOperation ? status === 'complete' : status === 'completed') ? 'line-through opacity-60' : ''}`}
                            style={{
                              backgroundColor: color,
                              color: 'white',
                              left: `calc(${pos.startCol * (100 / 7)}% + ${pos.startCol * 1}px)`,
                              width: `calc(${pos.span * (100 / 7)}% - ${pos.span * 1}px)`,
                              top: `${topPosition}px`,
                              height: `${rowHeight - 2}px`,
                              overflow: 'hidden',
                              lineHeight: `${rowHeight - 2}px`,
                            }}
                            title={`${name}${durationText}${estimatedHours ? ` - ${estimatedHours}h` : ''}${assignedTo ? ` - ${assignedTo}` : ''}`}
                          >
                            <div className="font-medium truncate">{name}</div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Yearly View - 4 boxes per row (one for each month in a quarter)
  const renderYearlyView = () => {
    const months: Date[][] = [];
    
    for (let i = 0; i < 12; i++) {
      const monthDate = new Date(viewDate.getFullYear(), i, 1);
      const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
      months.push([monthStart, monthEnd]);
    }

    return (
      <div className="p-4">
        <div className="grid grid-cols-4 gap-4">
          {months.map(([monthStart, monthEnd], idx) => {
            // Get operation instances for this month
            const monthOperationInstances = operationInstances.filter((instance) => {
              return instance.startDate <= monthEnd && instance.endDate >= monthStart;
            });

            // Get projects for this month
            const monthProjects = projects.filter((p) => {
              const pStart = new Date(p.startDate);
              const pEnd = new Date(p.endDate);
              return pStart <= monthEnd && pEnd >= monthStart;
            });

            return (
              <div
                key={idx}
                className="bg-background rounded-lg border border-border p-4 min-h-[300px]"
              >
                <h3 className="text-lg font-semibold text-text-primary mb-3">
                  {monthStart.toLocaleDateString('en-US', { month: 'short' })}
                </h3>
                <div className="space-y-2">
                  {/* Operations first */}
                  {monthOperationInstances.map((instance) => {
                    const operation = instance.operation;
                    const operationColor = operation.status === 'in-review' ? '#ef4444' : '#9ca3af';
                    const duration = Math.ceil((instance.endDate.getTime() - instance.startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                    const durationText = duration > 1 ? ` - ${duration} day${duration !== 1 ? 's' : ''}` : '';
                    const assignedToName = getEmployeeName((operation as any).assignedToEmployeeId?.toString(), operation.assignedTo);
                    const titleText = `${operation.name}${durationText}${operation.estimatedHours ? ` - ${operation.estimatedHours}h` : ''}${assignedToName ? ` - ${assignedToName}` : ''}`;
                    return (
                      <div
                        key={`operation-${operation._id.toString()}-${instance.startDate.getTime()}-${idx}`}
                        onClick={() => onOperationClick(operation)}
                        className={`text-sm p-2 rounded cursor-pointer hover:opacity-80 ${operation.status === 'complete' ? 'line-through opacity-60' : ''}`}
                        style={{
                          backgroundColor: operationColor,
                          color: 'white',
                        }}
                        title={titleText}
                      >
                        <div className="font-medium truncate">{operation.name}</div>
                      </div>
                    );
                  })}
                  {/* Projects */}
                  {monthProjects.map((project) => {
                    const projectColor = project.status === 'in-review' ? '#ef4444' : project.color;
                    return (
                      <div
                        key={project._id.toString()}
                        onClick={() => onProjectClick(project)}
                        className={`text-sm p-2 rounded cursor-pointer hover:opacity-80 ${project.status === 'completed' ? 'line-through opacity-60' : ''}`}
                        style={{
                          backgroundColor: projectColor,
                          color: 'white',
                        }}
                        title={project.name}
                      >
                        <div className="font-medium truncate">{project.name}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-background-card rounded-lg border border-border overflow-hidden">
      {/* Calendar Header with Navigation */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => navigatePeriod('prev')}>
            ←
          </Button>
          <h3 className="text-lg font-semibold text-text-primary min-w-[200px] text-center">
            {getViewTitle()}
          </h3>
          <Button variant="secondary" size="sm" onClick={() => navigatePeriod('next')}>
            →
          </Button>
        </div>
      </div>

      {/* Calendar Content */}
      {timeframe === 'today' && renderTodayView()}
      {timeframe === 'weekly' && renderWeeklyView()}
      {timeframe === 'monthly' && renderMonthlyView()}
      {timeframe === 'quarterly' && renderQuarterlyView()}
      {timeframe === 'yearly' && renderYearlyView()}
    </div>
  );
}
