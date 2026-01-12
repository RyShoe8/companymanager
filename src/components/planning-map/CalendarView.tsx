'use client';

import { useState, useEffect } from 'react';
import { IProject } from '@/lib/models/Project';
import { TimeframeType, formatDate, getTimeframeRange } from '@/lib/utils/dateUtils';
import Button from '@/components/ui/Button';

interface CalendarViewProps {
  projects: IProject[];
  timeframe: TimeframeType;
  currentDate: Date;
  onProjectClick: (project: IProject) => void;
  onTimeframeChange?: (start: Date, end: Date) => void;
}

export default function CalendarView({ projects, timeframe, currentDate, onProjectClick }: CalendarViewProps) {
  const [viewDate, setViewDate] = useState(currentDate);

  useEffect(() => {
    setViewDate(currentDate);
  }, [currentDate, timeframe]);

  // Get date range based on timeframe
  const getDateRange = () => {
    const range = getTimeframeRange(timeframe, viewDate);
    return { start: new Date(range.start), end: new Date(range.end) };
  };

  const { start: startDate, end: endDate } = getDateRange();

  const navigatePeriod = (direction: 'prev' | 'next') => {
    const newDate = new Date(viewDate);
    switch (timeframe) {
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
    setViewDate(newDate);
  };

  const goToToday = () => {
    setViewDate(new Date());
  };

  const getProjectsForDay = (day: Date) => {
    return projects.filter((project) => {
      const projectStart = new Date(project.startDate);
      const projectEnd = new Date(project.endDate);
      const dayStart = new Date(day);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(day);
      dayEnd.setHours(23, 59, 59, 999);
      
      return projectStart <= dayEnd && projectEnd >= dayStart;
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
        return formatDate(startDate);
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
    const todayProjects = getProjectsForDay(today);
    const dayName = today.toLocaleDateString('en-US', { weekday: 'long' });
    const dateStr = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    return (
      <div className="p-8 min-h-[600px]">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{dayName}</h2>
          <p className="text-xl text-gray-600 dark:text-gray-400">{dateStr}</p>
        </div>

        {todayProjects.length === 0 ? (
          <div className="text-center py-16 text-gray-500 dark:text-gray-400">
            <p className="text-lg mb-2">No projects scheduled for today</p>
            <p className="text-sm">Create a project to get started!</p>
          </div>
        ) : (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Projects ({todayProjects.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {todayProjects.map((project) => {
                const projectStart = new Date(project.startDate);
                const projectEnd = new Date(project.endDate);
                const totalDays = Math.ceil((projectEnd.getTime() - projectStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

                return (
                  <div
                    key={project._id.toString()}
                    onClick={() => onProjectClick(project)}
                    className="p-6 rounded-lg cursor-pointer hover:opacity-90 transition-opacity border-2 border-gray-200 dark:border-gray-700"
                    style={{
                      backgroundColor: project.color + '20',
                      borderColor: project.color,
                    }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h4 className="text-xl font-bold text-gray-900 dark:text-white" style={{ color: project.color }}>
                        {project.name}
                      </h4>
                      <span
                        className="px-3 py-1 rounded-full text-sm font-medium text-white"
                        style={{ backgroundColor: project.color }}
                      >
                        {project.status}
                      </span>
                    </div>
                    
                    {project.description && (
                      <p className="text-gray-700 dark:text-gray-300 mb-3">{project.description}</p>
                    )}

                    <div className="space-y-2">
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-gray-600 dark:text-gray-400">
                          <strong>Duration:</strong> {formatDate(projectStart)} - {formatDate(projectEnd)} ({totalDays} {totalDays === 1 ? 'day' : 'days'})
                        </span>
                      </div>
                      
                      {project.estimatedHours && (
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          <strong>Estimated Hours:</strong> {project.estimatedHours}h
                        </div>
                      )}
                      
                      {project.assignedTo && (
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          <strong>Assigned To:</strong> {project.assignedTo}
                        </div>
                      )}

                      {project.stages && project.stages.length > 0 && (
                        <div className="mt-4">
                          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Stages:</p>
                          <div className="space-y-2">
                            {project.stages.map((stage, idx) => {
                              const stageStart = new Date(stage.startDate);
                              const stageEnd = new Date(stage.endDate);
                              const stageDays = Math.ceil((stageEnd.getTime() - stageStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                              const isTodayInStage = today >= stageStart && today <= stageEnd;

                              if (!isTodayInStage) return null;

                              return (
                                <div
                                  key={idx}
                                  className="p-3 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                                >
                                  <div className="font-medium text-gray-900 dark:text-white">{stage.name}</div>
                                  {stage.description && (
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{stage.description}</p>
                                  )}
                                  <div className="flex gap-4 mt-2 text-xs text-gray-500 dark:text-gray-500">
                                    {stage.estimatedHours && <span>{stage.estimatedHours}h</span>}
                                    {stage.assignedTo && <span>Assigned: {stage.assignedTo}</span>}
                                    <span className="capitalize">{stage.status}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
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
        <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
          {dayNames.map((day) => (
            <div
              key={day}
              className="p-3 text-center text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900"
            >
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 divide-x divide-gray-200 dark:divide-gray-700 relative">
          {days.map((day, dayIdx) => {
            const isCurrentDay = isToday(day);

            return (
              <div
                key={dayIdx}
                className={`p-4 min-h-[360px] relative ${isCurrentDay ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
              >
                <div
                  className={`text-lg font-semibold mb-3 ${
                    isCurrentDay ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'
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
          {/* Render projects spanning across days */}
          {days.map((day, dayIdx) => {
            const dayProjects = getProjectsForDay(day);
            return dayProjects.map((project) => {
              const projectStart = new Date(project.startDate);
              const projectEnd = new Date(project.endDate);
              
              // Check if this is the start day
              const isStartDay = day.toDateString() === projectStart.toDateString();
              if (!isStartDay) return null;

              // Find start column
              const startCol = days.findIndex(d => d.toDateString() === projectStart.toDateString());
              if (startCol === -1) return null;

              // Calculate span
              const viewEnd = new Date(days[6]);
              viewEnd.setHours(23, 59, 59, 999);
              const projectEndInView = projectEnd < viewEnd ? projectEnd : viewEnd;
              const daysSpan = Math.ceil((projectEndInView.getTime() - projectStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
              const span = Math.min(daysSpan, 7 - startCol);

              return (
                <div
                  key={`${project._id.toString()}-weekly`}
                  onClick={() => onProjectClick(project)}
                  className="absolute text-sm p-2 rounded cursor-pointer hover:opacity-80 z-10"
                  style={{
                    backgroundColor: project.color,
                    color: 'white',
                    left: `calc(${startCol * (100 / 7)}% + ${startCol * 1}px)`,
                    width: `calc(${span * (100 / 7)}% - ${span * 1}px)`,
                    top: '60px',
                  }}
                  title={`${project.name} - ${formatDate(projectStart)} to ${formatDate(projectEnd)}${project.estimatedHours ? ` - ${project.estimatedHours}h` : ''}${project.assignedTo ? ` - ${project.assignedTo}` : ''}`}
                >
                  <div className="font-medium">{project.name}</div>
                  {project.assignedTo && (
                    <div className="text-xs opacity-90 mt-1">{project.assignedTo}</div>
                  )}
                </div>
              );
            });
          })}
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
        <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
          {dayNames.map((day) => (
            <div
              key={day}
              className="p-2 text-center text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900"
            >
              {day}
            </div>
          ))}
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-700 relative">
          {weeks.map((week, weekIdx) => (
            <div key={weekIdx} className="grid grid-cols-7 divide-x divide-gray-200 dark:divide-gray-700 min-h-[150px] relative">
              {week.map((day, dayIdx) => {
                const isCurrentDay = isToday(day);
                const inViewRange = isInViewRange(day);

                return (
                  <div
                    key={dayIdx}
                    className={`p-2 relative ${!inViewRange ? 'bg-gray-50 dark:bg-gray-900/50 opacity-50' : ''} ${
                      isCurrentDay ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                  >
                    <div
                      className={`text-sm font-medium mb-1 ${
                        isCurrentDay ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'
                      }`}
                    >
                      {day.getDate()}
                    </div>
                    {/* Project slots - projects will be rendered as absolute positioned elements */}
                    <div className="space-y-1 min-h-[120px]" style={{ position: 'relative' }}>
                      {/* Projects will be rendered here */}
                    </div>
                  </div>
                );
              })}
              {/* Render projects that span across days */}
              {week.map((day, dayIdx) => {
                const dayProjects = getProjectsForDay(day);
                return dayProjects.map((project) => {
                  const projectStart = new Date(project.startDate);
                  const projectEnd = new Date(project.endDate);
                  
                  // Check if this is the start day of the project in this week
                  const isStartDay = day.toDateString() === projectStart.toDateString();
                  if (!isStartDay) return null;

                  // Find the start column in this week
                  const startCol = week.findIndex(d => d.toDateString() === projectStart.toDateString());
                  if (startCol === -1) return null;

                  // Calculate how many days the project spans in this week
                  const weekEnd = new Date(week[6]);
                  weekEnd.setHours(23, 59, 59, 999);
                  const projectEndInWeek = projectEnd < weekEnd ? projectEnd : weekEnd;
                  const daysInWeek = Math.ceil((projectEndInWeek.getTime() - projectStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                  const span = Math.min(daysInWeek, 7 - startCol);

                  return (
                    <div
                      key={`${project._id.toString()}-${weekIdx}`}
                      onClick={() => onProjectClick(project)}
                      className="absolute text-xs p-1.5 rounded cursor-pointer hover:opacity-80 z-10"
                      style={{
                        backgroundColor: project.color,
                        color: 'white',
                        left: `calc(${startCol * (100 / 7)}% + ${startCol * 1}px)`,
                        width: `calc(${span * (100 / 7)}% - ${span * 1}px)`,
                        top: '24px',
                      }}
                      title={`${project.name} - ${formatDate(projectStart)} to ${formatDate(projectEnd)}${project.estimatedHours ? ` - ${project.estimatedHours}h` : ''}${project.assignedTo ? ` - ${project.assignedTo}` : ''}`}
                    >
                      <div className="font-medium truncate">{project.name}</div>
                    </div>
                  );
                });
              })}
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
          const monthProjects = projects.filter((p) => {
            const pStart = new Date(p.startDate);
            const pEnd = new Date(p.endDate);
            return pStart <= monthEnd && pEnd >= monthStart;
          });

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
              className="bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 p-6 min-h-[400px]"
            >
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                {monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h3>
              <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700 mb-2">
                {dayNames.map((day) => (
                  <div
                    key={day}
                    className="p-2 text-center text-sm font-semibold text-gray-700 dark:text-gray-300"
                  >
                    {day}
                  </div>
                ))}
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-700 relative">
                {weeks.map((week, weekIdx) => (
                  <div key={weekIdx} className="grid grid-cols-7 divide-x divide-gray-200 dark:divide-gray-700 min-h-[100px] relative">
                    {week.map((day, dayIdx) => {
                      const inMonth = day.getMonth() === monthStart.getMonth();
                      const isCurrentDay = isToday(day);

                      return (
                        <div
                          key={dayIdx}
                          className={`p-2 relative ${!inMonth ? 'bg-gray-100 dark:bg-gray-800/50 opacity-50' : ''} ${
                            isCurrentDay ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                          }`}
                        >
                          <div className={`text-sm font-medium mb-1 ${
                            isCurrentDay ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'
                          }`}>
                            {day.getDate()}
                          </div>
                          <div className="space-y-1 min-h-[80px]" style={{ position: 'relative' }}>
                            {/* Projects will be rendered as absolute positioned elements */}
                          </div>
                        </div>
                      );
                    })}
                    {/* Render projects spanning across days */}
                    {week.map((day, dayIdx) => {
                      const dayProjects = getProjectsForDay(day);
                      return dayProjects.map((project) => {
                        const projectStart = new Date(project.startDate);
                        const projectEnd = new Date(project.endDate);
                        
                        const isStartDay = day.toDateString() === projectStart.toDateString();
                        if (!isStartDay) return null;

                        const startCol = week.findIndex(d => d.toDateString() === projectStart.toDateString());
                        if (startCol === -1) return null;

                        const weekEnd = new Date(week[6]);
                        weekEnd.setHours(23, 59, 59, 999);
                        const projectEndInWeek = projectEnd < weekEnd ? projectEnd : weekEnd;
                        const daysInWeek = Math.ceil((projectEndInWeek.getTime() - projectStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                        const span = Math.min(daysInWeek, 7 - startCol);

                        return (
                          <div
                            key={`${project._id.toString()}-q${idx}-w${weekIdx}`}
                            onClick={() => onProjectClick(project)}
                            className="absolute text-xs p-1 rounded cursor-pointer hover:opacity-80 z-10"
                            style={{
                              backgroundColor: project.color,
                              color: 'white',
                              left: `calc(${startCol * (100 / 7)}% + ${startCol * 1}px)`,
                              width: `calc(${span * (100 / 7)}% - ${span * 1}px)`,
                              top: '24px',
                            }}
                            title={`${project.name} - ${formatDate(projectStart)} to ${formatDate(projectEnd)}`}
                          >
                            <div className="font-medium truncate">{project.name}</div>
                          </div>
                        );
                      });
                    })}
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
            const monthProjects = projects.filter((p) => {
              const pStart = new Date(p.startDate);
              const pEnd = new Date(p.endDate);
              return pStart <= monthEnd && pEnd >= monthStart;
            });

            return (
              <div
                key={idx}
                className="bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 p-4 min-h-[300px]"
              >
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  {monthStart.toLocaleDateString('en-US', { month: 'short' })}
                </h3>
                <div className="space-y-2">
                  {monthProjects.map((project) => (
                    <div
                      key={project._id.toString()}
                      onClick={() => onProjectClick(project)}
                      className="text-sm p-2 rounded cursor-pointer hover:opacity-80"
                      style={{
                        backgroundColor: project.color,
                        color: 'white',
                      }}
                      title={project.name}
                    >
                      <div className="font-medium truncate">{project.name}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Calendar Header with Navigation */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => navigatePeriod('prev')}>
            ←
          </Button>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white min-w-[200px] text-center">
            {getViewTitle()}
          </h3>
          <Button variant="secondary" size="sm" onClick={() => navigatePeriod('next')}>
            →
          </Button>
        </div>
        <Button variant="secondary" size="sm" onClick={goToToday}>
          Today
        </Button>
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
