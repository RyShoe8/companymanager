/**
 * Migration script to convert name-based assignments to employeeId-based assignments
 * Run this once to migrate existing data
 */

import connectDB from '@/lib/db/mongodb';
import Project from '@/lib/models/Project';
import Operation from '@/lib/models/Operation';
import Employee from '@/lib/models/Employee';

export async function migrateAssignmentsToEmployeeId() {
  try {
    await connectDB();
    
    console.log('Starting migration of assignments from names to employee IDs...');
    
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
    let operationsUpdated = 0;
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
          { assignedTo: { $exists: true, $ne: null, $ne: '' } },
          { 'tasks.assignedTo': { $exists: true, $ne: null, $ne: '' } }
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
    
    // Migrate operations
    for (const [orgId, orgEmployees] of Object.entries(employeesByOrg)) {
      // Get all users in this organization to find their operations
      const User = (await import('@/lib/models/User')).default;
      const orgUsers = await User.find({ organizationId: orgId });
      const orgUserIds = orgUsers.map(u => u._id);
      
      const operations = await Operation.find({ 
        userId: { $in: orgUserIds },
        assignedTo: { $exists: true, $ne: null, $ne: '' },
        assignedToEmployeeId: { $exists: false }
      });
      
      for (const operation of operations) {
        if (operation.assignedTo) {
          const employee = orgEmployees.find(e => e.name === operation.assignedTo);
          if (employee) {
            (operation as any).assignedToEmployeeId = employee._id;
            await operation.save();
            operationsUpdated++;
          }
        }
      }
    }
    
    console.log(`Migration complete!`);
    console.log(`- Projects updated: ${projectsUpdated}`);
    console.log(`- Tasks updated: ${tasksUpdated}`);
    console.log(`- Operations updated: ${operationsUpdated}`);
    
    return {
      projectsUpdated,
      tasksUpdated,
      operationsUpdated
    };
  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  }
}
