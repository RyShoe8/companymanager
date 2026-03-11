/**
 * Migration script to convert name-based assignments to employeeId-based assignments
 * Run this once to migrate existing data
 */

import connectDB from '@/lib/db/mongodb';
import Project from '@/lib/models/Project';
import Employee from '@/lib/models/Employee';

export async function migrateAssignmentsToEmployeeId() {
  try {
    await connectDB();

    // Starting migration of assignments from names to employee IDs

    // Get all employees grouped by organization
    const employees = await Employee.find({}).lean();
    const employeesByOrg: Record<string, Array<{ _id: any; name: string }>> = {};

    employees.forEach(emp => {
      if (!employeesByOrg[emp.organizationId]) {
        employeesByOrg[emp.organizationId] = [];
      }
      employeesByOrg[emp.organizationId].push({ _id: emp._id, name: emp.name });
    });

    let projectsUpdated = 0;
    let tasksUpdated = 0;

    // Migrate projects
    // Get all users grouped by organization to find their projects
    const User = (await import('@/lib/models/User')).default;
    const allUsers = await User.find({}).lean();
    const usersByOrg: Record<string, any[]> = {};

    allUsers.forEach(u => {
      if (!usersByOrg[u.organizationId]) {
        usersByOrg[u.organizationId] = [];
      }
      usersByOrg[u.organizationId].push(u._id);
    });

    for (const [orgId, orgEmployees] of Object.entries(employeesByOrg)) {
      const orgUserIds = usersByOrg[orgId] || [];
      const projects = await Project.find({
        userId: { $in: orgUserIds },
        $or: [
          { assignedTo: { $exists: true, $ne: null, $nin: [''] } },
          { 'tasks.assignedTo': { $exists: true, $ne: null, $nin: [''] } }
        ]
      });

      for (const project of projects) {
        let updated = false;

        // Migrate project-level assignment
        if (project.assignedTo && !project.assignedToEmployeeId) {
          const employee = orgEmployees.find(e => e.name === project.assignedTo);
          if (employee) {
            (project as any).assignedToEmployeeId = employee._id;
            updated = true;
          }
        }

        // Migrate task-level assignments
        if (project.tasks && Array.isArray(project.tasks)) {
          for (let i = 0; i < project.tasks.length; i++) {
            const task = project.tasks[i] as any;
            if (task.assignedTo && !task.assignedToEmployeeId) {
              const employee = orgEmployees.find(e => e.name === task.assignedTo);
              if (employee) {
                task.assignedToEmployeeId = employee._id;
                updated = true;
                tasksUpdated++;
              }
            }
          }
        }

        if (updated) {
          await project.save();
          projectsUpdated++;
        }
      }
    }


    // Migration complete!
    // - Projects updated
    // - Tasks updated

    return {
      projectsUpdated,
      tasksUpdated
    };
  } catch (error) {
    // Migration error
    throw error;
  }
}
