import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import connectDB from '@/lib/db/mongodb';
import Project from '@/lib/models/Project';
import User from '@/lib/models/User';
import { requireAuth } from '@/lib/auth/middleware';
import { getOrganizationUserIds, migrateStagesToTasks, migrateProjectFields } from '@/lib/utils/apiHelpers';
import { parseDateSafe, getDefaultTaskDates } from '@/lib/utils/dateUtils';
import { Types } from 'mongoose';
import { parseCssColorInput } from '@/lib/utils/cssColorInput';
import { labelForFontPaletteIndex, maxFontPaletteEntries, parseFontFamilyInput } from '@/lib/utils/fontPaletteInput';
import {
  findTaskAssigneeOffProjectTeam,
  sanitizeTaskAssigneesForProjectTeam,
} from '@/lib/utils/projectTeam';
import { sanitizeSocialLinks, validateSocialLinksUpdate } from '@/lib/utils/socialUrls';
import { touchProjectActivity } from '@/lib/projects/touchProjectActivity';
import { cleanupNewlyCompletedTasks, cleanupProjectMedia } from '@/lib/projects/projectCleanup';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();
    const { id } = await params;

    // Get user's organizationId
    const user = await User.findById(session.userId);
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'User or organization not found' }, { status: 404 });
    }

    // Find all users in the same organization
    const orgUserIds = await getOrganizationUserIds(session.userId, user.organizationId);

    const project = await Project.findOne({ _id: id, userId: { $in: orgUserIds } }).lean();
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Migrate stages to tasks + projectType/category swap
    const migratedProject = migrateProjectFields(migrateStagesToTasks(project));
    if (JSON.stringify(migratedProject) !== JSON.stringify(project)) {
      // Save migration if it occurred (async, don't wait)
      Project.findByIdAndUpdate(id, {
        tasks: (migratedProject as any).tasks,
        projectType: migratedProject.projectType,
        category: migratedProject.category
      }, { new: true }).catch(() => {
        // Error saving migration
      });
    }

    return NextResponse.json(migratedProject);
  } catch (error) {
    console.error('Error fetching project:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    // Safely parse JSON body with better error handling
    let body: any;
    try {
      body = await request.json();
      if (!body || typeof body !== 'object') {
        console.error('Invalid body received:', body);
        return NextResponse.json({ error: 'Request body must be a valid JSON object' }, { status: 400 });
      }
      // Only log if it's not just a status update (to reduce noise)
      if (Object.keys(body).length > 1 || !body.status) {
        console.log('Received update body:', Object.keys(body));
      }
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown error';
      // Check if it's an empty body error
      if (errorMessage.includes('Unexpected end of JSON input') || errorMessage.includes('JSON')) {
        return NextResponse.json({ error: 'Request body is empty or invalid JSON', details: errorMessage }, { status: 400 });
      }
      return NextResponse.json({ error: 'Invalid JSON in request body', details: errorMessage }, { status: 400 });
    }

    const {
      name,
      description,
      url,
      urls,
      devUrl,
      liveUrl,
      projectType,
      category,
      color,
      colorPalette,
      fontPalette,
      logo,
      status,
      endDate,
      estimatedHours,
      assignedTo,
      assignedToEmployeeId,
      assignedToEmployeeIds,
      assignedToNames,
      tasks,
      dismissedChecklistIds,
      socialLinks,
      socialsToolbarVisible,
    } = body;

    await connectDB();
    const { id } = await params;

    // Get user's organizationId
    const user = await User.findById(session.userId);
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'User or organization not found' }, { status: 404 });
    }

    // Check if user is a Manager or Administrator
    const Employee = (await import('@/lib/models/Employee')).default;
    const currentUserEmployee = await Employee.findOne({ userId: session.userId, organizationId: user.organizationId });
    const isManagerOrAdmin = currentUserEmployee && (currentUserEmployee.role === 'Manager' || currentUserEmployee.role === 'Administrator');

    // Find all users in the same organization
    const orgUserIds = await getOrganizationUserIds(session.userId, user.organizationId);

    const project = await Project.findOne({ _id: id, userId: { $in: orgUserIds } });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    let previousTasksSnapshot: Array<{ _id?: { toString: () => string }; status?: unknown }> = [];

    // Apply migration to the instance before modifying it
    migrateProjectFields(project);

    // If user is not a Manager or Administrator, only allow status change from active to in-review
    if (!isManagerOrAdmin) {
      if (currentUserEmployee?.role !== 'User') {
        return NextResponse.json({ error: 'Only Managers, Administrators, and Users can update projects' }, { status: 403 });
      }

      // Regular users can only change status from in-development to in-review
      if (status !== undefined && status !== project.status) {
        if (project.status !== 'in-development' || status !== 'in-review') {
          return NextResponse.json({ error: 'Users can only change status from in-development to in-review' }, { status: 403 });
        }
      }

      // Regular users cannot change other fields
      if (name !== undefined || description !== undefined || url !== undefined || urls !== undefined ||
        devUrl !== undefined || liveUrl !== undefined ||
        projectType !== undefined || color !== undefined || colorPalette !== undefined || fontPalette !== undefined || logo !== undefined || endDate !== undefined || estimatedHours !== undefined ||
        assignedTo !== undefined || assignedToEmployeeId !== undefined || assignedToEmployeeIds !== undefined ||
        assignedToNames !== undefined || tasks !== undefined || dismissedChecklistIds !== undefined ||
        socialLinks !== undefined || socialsToolbarVisible !== undefined) {
        return NextResponse.json({ error: 'Users can only change project status' }, { status: 403 });
      }
    }

    if (name !== undefined) project.name = name;
    if (description !== undefined) project.description = description;
    if (url !== undefined) project.url = url;
    if (urls !== undefined) project.urls = urls;
    if (devUrl !== undefined) {
      project.devUrl =
        devUrl === null || devUrl === '' ? undefined : String(devUrl).trim() || undefined;
    }
    if (liveUrl !== undefined) {
      project.liveUrl =
        liveUrl === null || liveUrl === '' ? undefined : String(liveUrl).trim() || undefined;
    }
    if (socialLinks !== undefined) {
      const socialError = validateSocialLinksUpdate(socialLinks);
      if (socialError) {
        return NextResponse.json({ error: socialError }, { status: 400 });
      }
      project.socialLinks = sanitizeSocialLinks(socialLinks) ?? [];
    }
    if (socialsToolbarVisible !== undefined) {
      project.socialsToolbarVisible = socialsToolbarVisible !== false;
    }
    if (category !== undefined) project.category = category;
    if (projectType !== undefined) {
      project.projectType = projectType;
      if (projectType === 'client' && !project.clientPortalSlug) {
        project.clientPortalSlug = crypto.randomBytes(12).toString('base64url');
        project.clientPortalToken = crypto.randomBytes(24).toString('base64url');
      }
    }
    if (color !== undefined) project.color = color;

    if (colorPalette !== undefined) {
      if (!Array.isArray(colorPalette)) {
        return NextResponse.json({ error: 'colorPalette must be an array' }, { status: 400 });
      }
      const sanitized: string[] = [];
      for (let i = 0; i < colorPalette.length; i++) {
        const item = colorPalette[i];
        if (typeof item !== 'string') {
          return NextResponse.json({ error: `Invalid color at index ${i}: expected string` }, { status: 400 });
        }
        const t = item.trim();
        if (!t) continue;
        const parsed = parseCssColorInput(t);
        if (!parsed.ok) {
          return NextResponse.json({ error: `Invalid color at index ${i}: ${t}` }, { status: 400 });
        }
        sanitized.push(parsed.normalized);
      }
      project.colorPalette = sanitized;
      if (sanitized.length > 0) {
        project.color = sanitized[0];
      }
    }

    if (fontPalette !== undefined) {
      if (!Array.isArray(fontPalette)) {
        return NextResponse.json({ error: 'fontPalette must be an array' }, { status: 400 });
      }
      if (fontPalette.length > maxFontPaletteEntries) {
        return NextResponse.json(
          { error: `fontPalette cannot exceed ${maxFontPaletteEntries} entries` },
          { status: 400 }
        );
      }
      const sanitizedFonts: string[] = [];
      for (let i = 0; i < fontPalette.length; i++) {
        const item = fontPalette[i];
        if (typeof item !== 'string') {
          return NextResponse.json({ error: `Invalid font at index ${i}: expected string` }, { status: 400 });
        }
        const t = item.trim();
        if (!t) continue;
        const parsed = parseFontFamilyInput(t);
        if (!parsed.ok) {
          return NextResponse.json(
            { error: `Invalid ${labelForFontPaletteIndex(i)}: ${t}. Use letters, numbers, spaces, commas, quotes, or hyphens.` },
            { status: 400 }
          );
        }
        sanitizedFonts.push(parsed.normalized);
      }
      if (sanitizedFonts.length === 0) {
        return NextResponse.json({ error: 'fontPalette must include at least one valid font' }, { status: 400 });
      }
      project.fontPalette = sanitizedFonts;
    }
    if (logo !== undefined) project.logo = logo || undefined;
    const previousStatus = project.status;
    if (status !== undefined) project.status = status;
    if (endDate !== undefined) {
      if (endDate === null || endDate === '') {
        project.set('endDate', undefined);
      } else {
        project.endDate = new Date(endDate);
      }
    }
    if (estimatedHours !== undefined) {
      project.estimatedHours = estimatedHours === null || estimatedHours === '' ? undefined : estimatedHours;
    }
    // Handle multiple employee assignments (preferred)
    if (assignedToEmployeeIds !== undefined) {
      if (assignedToEmployeeIds === null || !Array.isArray(assignedToEmployeeIds) || assignedToEmployeeIds.length === 0) {
        project.assignedToEmployeeIds = [];
        project.assignedToNames = [];
        project.assignedToEmployeeId = undefined;
        project.assignedTo = undefined;
      } else {
        project.assignedToEmployeeIds = assignedToEmployeeIds.map((id: string) => new Types.ObjectId(id));
        if (assignedToNames && Array.isArray(assignedToNames) && assignedToNames.length > 0) {
          project.assignedToNames = assignedToNames;
        } else {
          // Fetch names from employee records
          const assignedEmployees = await Employee.find({ _id: { $in: project.assignedToEmployeeIds } });
          project.assignedToNames = assignedEmployees.map(emp => emp.name);
        }
        // Keep legacy fields for backward compatibility (use first assignment)
        project.assignedToEmployeeId = project.assignedToEmployeeIds[0];
        project.assignedTo = project.assignedToNames[0];
      }
    } else if (assignedToEmployeeId !== undefined) {
      // Legacy single assignment support
      if (assignedToEmployeeId === null || assignedToEmployeeId === '') {
        project.assignedToEmployeeId = undefined;
        project.assignedTo = undefined;
        project.assignedToEmployeeIds = [];
        project.assignedToNames = [];
      } else {
        project.assignedToEmployeeId = new Types.ObjectId(assignedToEmployeeId);
        const assignedEmployee = await Employee.findById(assignedToEmployeeId);
        if (assignedEmployee) {
          project.assignedTo = assignedEmployee.name;
          project.assignedToEmployeeIds = [project.assignedToEmployeeId];
          project.assignedToNames = [assignedEmployee.name];
        }
      }
    } else if (assignedTo !== undefined) {
      // Legacy support: if name provided, try to find employee and set ID
      if (assignedTo === null || assignedTo === '') {
        project.assignedTo = undefined;
        project.assignedToEmployeeId = undefined;
        project.assignedToEmployeeIds = [];
        project.assignedToNames = [];
      } else {
        const assignedEmployee = await Employee.findOne({
          name: assignedTo,
          organizationId: user.organizationId
        });
        if (assignedEmployee) {
          project.assignedToEmployeeId = assignedEmployee._id;
          project.assignedToEmployeeIds = [assignedEmployee._id];
          project.assignedToNames = [assignedEmployee.name];
        }
        project.assignedTo = assignedTo;
      }
    }

    // Only process tasks if they're being updated (skip if only status/other fields are being updated)
    if (tasks !== undefined) {
      if (Array.isArray(tasks)) {
        const { tasks: sanitizedTasks, stripped } = sanitizeTaskAssigneesForProjectTeam(project, tasks);
        if (stripped.length > 0) {
          console.warn(
            'Stripped off-team task assignees:',
            stripped.map((s) => `${s.taskName} (${s.assigneeId})`).join(', ')
          );
        }

        const assigneeIssue = findTaskAssigneeOffProjectTeam(project, sanitizedTasks);
        if (assigneeIssue) {
          return NextResponse.json(
            {
              error: assigneeIssue.message,
              taskIndex: assigneeIssue.taskIndex,
              taskName: assigneeIssue.taskName,
              assigneeId: assigneeIssue.assigneeId,
            },
            { status: 400 }
          );
        }

        // Debug: Log received tasks to verify status is included
        console.log('Processing tasks update:', sanitizedTasks.length, 'tasks');

        const previousTasks = [...(project.tasks ?? [])];
        previousTasksSnapshot = previousTasks;

        project.tasks = await Promise.all(sanitizedTasks.map(async (task: any, index: number) => {
          // Handle dates - provide defaults if not specified or invalid
          const defaultDates = getDefaultTaskDates();
          let startDate = parseDateSafe(task.startDate) || defaultDates.startDate;
          let endDate = parseDateSafe(task.endDate) || defaultDates.endDate;

          // Normalize dates to midnight UTC for comparison (ignore time component); UTC getters match stored calendar days)
          if (startDate) {
            startDate = new Date(
              Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate())
            );
          }
          if (endDate) {
            endDate = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()));
          }

          // Preserve all task fields, especially status
          // Explicitly check for status to avoid overwriting valid statuses with 'active'
          // Handle both 'completed' and 'complete' for backward compatibility
          let taskStatus: 'active' | 'completed' | 'in-review' = 'active';
          if (task.status !== undefined && task.status !== null) {
            const statusStr = String(task.status).toLowerCase().trim();
            if (statusStr === 'completed' || statusStr === 'complete') {
              taskStatus = 'completed';
            } else if (statusStr === 'in-review' || statusStr === 'in_review') {
              taskStatus = 'in-review';
            } else if (statusStr === 'active') {
              taskStatus = 'active';
            }
          }

          // Debug logging to help identify status preservation issues
          console.log(`Task ${index} "${task.name || 'Untitled'}": received status="${task.status}" (type: ${typeof task.status}), setting to="${taskStatus}"`);

          // Build taskData explicitly - don't rely on spread operator for status
          const taskData: any = {
            name: task.name || 'Untitled Task',
            description: task.description || undefined,
            startDate,
            endDate,
            estimatedHours: task.estimatedHours !== undefined && task.estimatedHours !== null ? task.estimatedHours : undefined,
            status: taskStatus, // ALWAYS explicitly set status - this is critical!
          };

          if (task._id && Types.ObjectId.isValid(String(task._id))) {
            taskData._id = new Types.ObjectId(String(task._id));
          }

          // Handle employee assignment for tasks - prefer employeeIds array, then single id, then legacy name
          if (task.assignedToEmployeeIds !== undefined) {
            if (!Array.isArray(task.assignedToEmployeeIds) || task.assignedToEmployeeIds.length === 0) {
              taskData.assignedToEmployeeIds = [];
              taskData.assignedToEmployeeId = undefined;
              taskData.assignedTo = undefined;
            } else {
              taskData.assignedToEmployeeIds = task.assignedToEmployeeIds.map((id: string) => new Types.ObjectId(id));
              const assignedEmployees = await Employee.find({ _id: { $in: taskData.assignedToEmployeeIds } });
              taskData.assignedTo = assignedEmployees.map((e) => e.name).join(', ');
              taskData.assignedToEmployeeId = taskData.assignedToEmployeeIds[0];
            }
          } else if (task.assignedToEmployeeId) {
            taskData.assignedToEmployeeId = new Types.ObjectId(task.assignedToEmployeeId);
            taskData.assignedToEmployeeIds = [taskData.assignedToEmployeeId];
            const assignedEmployee = await Employee.findById(task.assignedToEmployeeId);
            if (assignedEmployee) {
              taskData.assignedTo = assignedEmployee.name;
            }
          } else if (task.assignedTo) {
            // Legacy support: if name provided, try to find employee and set ID
            const assignedEmployee = await Employee.findOne({
              name: task.assignedTo,
              organizationId: user.organizationId
            });
            if (assignedEmployee) {
              taskData.assignedToEmployeeId = assignedEmployee._id;
              taskData.assignedToEmployeeIds = [assignedEmployee._id];
            }
            taskData.assignedTo = task.assignedTo;
          } else {
            // Clear assignment if not provided
            taskData.assignedToEmployeeId = undefined;
            taskData.assignedToEmployeeIds = [];
            taskData.assignedTo = undefined;
          }

          // Don't delete _id for subdocuments - Mongoose needs it to identify existing tasks
          // Only remove __v as it's a version key
          delete taskData.__v;

          // Final verification that status is set
          if (!taskData.status || !['active', 'completed', 'in-review'].includes(taskData.status)) {
            console.error(`Task ${index} "${taskData.name}" has invalid status "${taskData.status}", defaulting to 'active'`);
            taskData.status = 'active';
          }

          return taskData;
        }));
        const postAssigneeIssue = findTaskAssigneeOffProjectTeam(project, project.tasks ?? []);
        if (postAssigneeIssue) {
          return NextResponse.json(
            {
              error: postAssigneeIssue.message,
              taskIndex: postAssigneeIssue.taskIndex,
              taskName: postAssigneeIssue.taskName,
              assigneeId: postAssigneeIssue.assigneeId,
            },
            { status: 400 }
          );
        }
      } else {
        project.tasks = [];
      }
    }

    // Explicitly mark tasks array as modified to ensure Mongoose saves it
    if (tasks !== undefined) {
      project.markModified('tasks');
    }

    if (dismissedChecklistIds !== undefined) {
      if (Array.isArray(dismissedChecklistIds)) {
        project.dismissedChecklistIds = dismissedChecklistIds
          .filter((id: unknown) => id && Types.ObjectId.isValid(id as string))
          .map((id: string) => new Types.ObjectId(id));
      } else {
        project.dismissedChecklistIds = [];
      }
    }

    // Save the project
    await project.save();

    if (tasks !== undefined && Array.isArray(tasks)) {
      await cleanupNewlyCompletedTasks(id, previousTasksSnapshot ?? [], project.tasks ?? []);
    }

    await touchProjectActivity(id);

    // Reload the project to ensure we return the latest data
    const savedProject = await Project.findById(id).lean();
    if (!savedProject) {
      return NextResponse.json({ error: 'Project not found after save' }, { status: 404 });
    }

    // Only log task details if tasks were updated (to reduce noise)
    if (tasks !== undefined && savedProject.tasks && Array.isArray(savedProject.tasks)) {
      console.log('Final tasks being returned:', savedProject.tasks.length, 'tasks');
    }

    return NextResponse.json(savedProject);
  } catch (error) {
    // Update project error - log the actual error for debugging
    console.error('Error updating project:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Internal server error', details: errorMessage }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();
    const { id } = await params;

    // Get user's organizationId
    const user = await User.findById(session.userId);
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'User or organization not found' }, { status: 404 });
    }

    // Find all users in the same organization
    const orgUserIds = await getOrganizationUserIds(session.userId, user.organizationId);

    const project = await Project.findOne({ _id: id, userId: { $in: orgUserIds } });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    await cleanupProjectMedia(id, project);

    await Project.findOneAndDelete({ _id: id, userId: { $in: orgUserIds } });

    return NextResponse.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Error deleting project:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
