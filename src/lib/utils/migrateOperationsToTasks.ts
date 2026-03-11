import connectDB from '@/lib/db/mongodb';
import Project from '@/lib/models/Project';
import mongoose, { Schema } from 'mongoose';

/**
 * Migration script to convert existing Operation documents to Project tasks
 */
export async function migrateOperationsToTasks() {
    try {
        await connectDB();

        // Define a temporary Operation schema since the model was deleted from the codebase
        const OperationSchema = new Schema({
            name: { type: String, required: true },
            description: { type: String },
            startDate: { type: Date, required: true },
            endDate: { type: Date, required: true },
            estimatedHours: { type: Number },
            assignedTo: { type: String },
            assignedToEmployeeId: { type: Schema.Types.ObjectId, ref: 'Employee' },
            status: { type: String, enum: ['planning', 'active', 'complete', 'in-review'] },
            projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
            userId: { type: Schema.Types.ObjectId, ref: 'User', required: true }
        });

        // Use raw mongoose to access the collection if the model isn't registered
        const Operation = mongoose.models.Operation || mongoose.model('Operation', OperationSchema);

        const operations = await Operation.find({});
        console.log(`Found ${operations.length} operations to migrate.`);

        let migratedCount = 0;
        let errorCount = 0;

        for (const op of operations) {
            try {
                const project = await Project.findById(op.projectId);
                if (!project) {
                    console.warn(`Project ${op.projectId} not found for operation ${op._id}. Skipping.`);
                    continue;
                }

                // Map operation status to task status
                let taskStatus: 'active' | 'completed' | 'in-review' = 'active';
                if (op.status === 'complete') {
                    taskStatus = 'completed';
                } else if (op.status === 'in-review') {
                    taskStatus = 'in-review';
                }

                const task = {
                    name: op.name,
                    description: op.description,
                    startDate: op.startDate,
                    endDate: op.endDate,
                    estimatedHours: op.estimatedHours,
                    assignedTo: op.assignedTo,
                    assignedToEmployeeId: op.assignedToEmployeeId,
                    status: taskStatus
                };

                // Initialize tasks array if it doesn't exist
                if (!project.tasks) {
                    project.tasks = [];
                }

                // Add task to project
                project.tasks.push(task as any);
                await project.save();

                // Mark operation as migrated or just delete it later
                migratedCount++;
            } catch (err) {
                console.error(`Error migrating operation ${op._id}:`, err);
                errorCount++;
            }
        }

        // Optionally: delete operations after migration
        // if (migratedCount > 0 && errorCount === 0) {
        //   await Operation.deleteMany({});
        // }

        return {
            migratedCount,
            errorCount,
            totalFound: operations.length
        };
    } catch (error) {
        console.error('Migration failed:', error);
        throw error;
    }
}
