/**
 * Script to restore assignments for a specific employee by name
 * This is useful when assignments were lost due to duplicate names or migration issues
 */

import connectDB from '@/lib/db/mongodb';
import Project from '@/lib/models/Project';
import Operation from '@/lib/models/Operation';
import Employee from '@/lib/models/Employee';
import { Types } from 'mongoose';

export async function restoreAssignmentsForEmployee(employeeName: string, organizationId: string) {
  try {
    await connectDB();
    
    console.log(`Restoring assignments for employee: ${employeeName} in organization: ${organizationId}`);
    
    // Find the employee
    const employee = await Employee.findOne({ name: employeeName, organizationId });
    if (!employee) {
      throw new Error(`Employee "${employeeName}" not found in organization ${organizationId}`);
    }
    
    const employeeId = employee._id;
    const User = (await import('@/lib/models/User')).default;
    const orgUsers = await User.find({ organizationId });
    const orgUserIds = orgUsers.map(u => u._id);
    
    let projectsUpdated = 0;
    let operationsUpdated = 0;
    let tasksUpdated = 0;
    
    // Restore project assignments
    const projects = await Project.find({ 
      userId: { $in: orgUserIds },
      $or: [
        { assignedTo: employeeName },
        { 'tasks.assignedTo': employeeName }
      ]
    });
    
    for (const project of projects) {
      let updated = false;
      
      // Restore project-level assignment
      if (project.assignedTo === employeeName && !project.assignedToEmployeeId) {
        (project as any).assignedToEmployeeId = employeeId;
        updated = true;
      }
      
      // Restore task-level assignments
      if (project.tasks && Array.isArray(project.tasks)) {
        for (let i = 0; i < project.tasks.length; i++) {
          const task = project.tasks[i] as any;
          if (task.assignedTo === employeeName && !task.assignedToEmployeeId) {
            task.assignedToEmployeeId = employeeId;
            updated = true;
            tasksUpdated++;
          }
        }
      }
      
      if (updated) {
        await project.save();
        projectsUpdated++;
      }
    }
    
    // Restore operation assignments
    const operations = await Operation.find({ 
      userId: { $in: orgUserIds },
      assignedTo: employeeName,
      assignedToEmployeeId: { $exists: false }
    });
    
    for (const operation of operations) {
      (operation as any).assignedToEmployeeId = employeeId;
      await operation.save();
      operationsUpdated++;
    }
    
    console.log(`Restoration complete!`);
    console.log(`- Projects updated: ${projectsUpdated}`);
    console.log(`- Tasks updated: ${tasksUpdated}`);
    console.log(`- Operations updated: ${operationsUpdated}`);
    
    return {
      projectsUpdated,
      tasksUpdated,
      operationsUpdated
    };
  } catch (error) {
    console.error('Restoration error:', error);
    throw error;
  }
}
