import { describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import type { IEmployee } from '@/lib/models/Employee';
import type { IProject, IProjectTask } from '@/lib/models/Project';
import type { IContentItem } from '@/lib/models/ContentItem';
import {
  buildStageHoursBreakdown,
  getProjectStage,
  projectFallbackHours,
  sumEmployeeTaskHoursInProject,
} from '@/lib/utils/employeeUtilizationBreakdown';

const employeeId = new Types.ObjectId();
const employee = { _id: employeeId, name: 'Alex' } as IEmployee;

const rangeStart = new Date('2026-06-01T00:00:00');
const rangeEnd = new Date('2026-06-07T23:59:59');

function fullOverlapHours(
  _rangeStart: Date,
  _rangeEnd: Date,
  _itemStart: Date,
  _itemEnd: Date,
  totalHours: number
): number {
  return totalHours;
}

function task(partial: Partial<IProjectTask>): IProjectTask {
  return {
    name: 'Task',
    startDate: new Date('2026-06-02'),
    endDate: new Date('2026-06-04'),
    assignedToEmployeeId: employeeId,
    ...partial,
  };
}

function isAssignedToEmployee(taskItem: IProjectTask, emp: IEmployee): boolean {
  return taskItem.assignedToEmployeeId?.toString() === emp._id.toString();
}

function isAssignedToOtherEmployee(taskItem: IProjectTask, emp: IEmployee): boolean {
  const id = taskItem.assignedToEmployeeId?.toString();
  return !!id && id !== emp._id.toString();
}

describe('employeeUtilizationBreakdown', () => {
  it('maps project status to stage', () => {
    expect(getProjectStage('planning')).toBe('Plan');
    expect(getProjectStage('in-development')).toBe('Build');
    expect(getProjectStage('launched')).toBe('Run');
  });

  it('buckets committed task hours into Plan for planning projects', () => {
    const project = {
      _id: new Types.ObjectId(),
      status: 'planning',
      tasks: [task({ estimatedHours: 8, status: 'active' })],
    } as unknown as IProject;

    const breakdown = buildStageHoursBreakdown({
      projects: [project],
      employee,
      mode: 'committed',
      rangeStart,
      rangeEnd,
      calculateHoursInRange: fullOverlapHours,
      isTaskAssignedToEmployee: isAssignedToEmployee,
      isTaskAssignedToOtherEmployee: isAssignedToOtherEmployee,
    });

    expect(breakdown.Plan).toBe(8);
    expect(breakdown.Build).toBe(0);
    expect(breakdown.Run).toBe(0);
  });

  it('buckets completed task hours into Plan for planning projects', () => {
    const project = {
      _id: new Types.ObjectId(),
      status: 'planning',
      tasks: [task({ estimatedHours: 5, status: 'completed' })],
    } as unknown as IProject;

    const breakdown = buildStageHoursBreakdown({
      projects: [project],
      employee,
      mode: 'completed',
      rangeStart,
      rangeEnd,
      calculateHoursInRange: fullOverlapHours,
      isTaskAssignedToEmployee: isAssignedToEmployee,
      isTaskAssignedToOtherEmployee: isAssignedToOtherEmployee,
    });

    expect(breakdown.Plan).toBe(5);
  });

  it('buckets published content into Build for in-development projects', () => {
    const projectId = new Types.ObjectId();
    const project = {
      _id: projectId,
      status: 'in-development',
      tasks: [],
    } as unknown as IProject;
    const content = [
      {
        _id: new Types.ObjectId(),
        projectId,
        assignedToEmployeeId: employeeId,
        estimatedHours: 3,
        status: 'published',
      },
    ] as unknown as IContentItem[];

    const breakdown = buildStageHoursBreakdown({
      projects: [project],
      employee,
      mode: 'completed',
      rangeStart,
      rangeEnd,
      calculateHoursInRange: fullOverlapHours,
      isTaskAssignedToEmployee: isAssignedToEmployee,
      isTaskAssignedToOtherEmployee: isAssignedToOtherEmployee,
      contentItems: content,
      projectById: new Map([[projectId.toString(), project]]),
    });

    expect(breakdown.Build).toBe(3);
  });

  it('uses project fallback only when employee has no matching task hours', () => {
    const project = {
      _id: new Types.ObjectId(),
      status: 'planning',
      assignedToEmployeeId: employeeId,
      estimatedHours: 20,
      tasks: [task({ estimatedHours: 6, status: 'active' })],
    } as unknown as IProject;

    expect(
      projectFallbackHours({
        project,
        employee,
        mode: 'committed',
        employeeTaskHoursInProject: 6,
        isTaskAssignedToOtherEmployee: isAssignedToOtherEmployee,
      })
    ).toBe(0);

    const emptyTaskProject = {
      ...project,
      tasks: [],
    } as unknown as IProject;

    expect(
      projectFallbackHours({
        project: emptyTaskProject,
        employee,
        mode: 'committed',
        employeeTaskHoursInProject: 0,
        isTaskAssignedToOtherEmployee: isAssignedToOtherEmployee,
      })
    ).toBe(20);
  });

  it('sums task hours in project for completed mode', () => {
    const project = {
      _id: new Types.ObjectId(),
      status: 'planning',
      tasks: [
        task({ estimatedHours: 4, status: 'completed' }),
        task({ estimatedHours: 9, status: 'active' }),
      ],
    } as unknown as IProject;

    expect(
      sumEmployeeTaskHoursInProject({
        project,
        employee,
        mode: 'completed',
        rangeStart,
        rangeEnd,
        calculateHoursInRange: fullOverlapHours,
        isTaskAssignedToEmployee: isAssignedToEmployee,
      })
    ).toBe(4);
  });
});
