import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type ProjectStatus = 'planning' | 'in-development' | 'launched' | 'in-review' | 'completed';
export type ProjectType = 'website' | 'store' | 'app' | 'generic';
export type ProjectClientType = 'internal' | 'client';
export type TaskStatus = 'active' | 'completed' | 'in-review';

export interface IProjectTask {
  name: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  estimatedHours?: number;
  assignedTo?: string; // Legacy - kept for backward compatibility
  assignedToEmployeeId?: Types.ObjectId; // New field using employee ID
  status?: TaskStatus;
}

export interface IProject extends Document {
  name: string;
  description?: string;
  url?: string; // Legacy field, kept for backward compatibility
  urls?: string[]; // New field for multiple URLs
  projectType: ProjectType;
  color: string;
  logo?: string; // Project logo URL
  status: ProjectStatus;
  endDate?: Date; // Optional end date - project stops appearing on status page after this date
  estimatedHours?: number;
  assignedTo?: string; // Legacy - kept for backward compatibility
  assignedToEmployeeId?: Types.ObjectId; // Legacy single assignment - kept for backward compatibility
  assignedToEmployeeIds?: Types.ObjectId[]; // New field for multiple assignments using employee IDs
  assignedToNames?: string[]; // New field for multiple assignments using names (for backward compatibility)
  tasks?: IProjectTask[];
  userId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    url: {
      type: String,
      trim: true,
    },
    urls: {
      type: [String],
      default: [],
    },
    projectType: {
      type: String,
      enum: ['website', 'store', 'app', 'generic'],
      required: true,
      default: 'generic',
    },
    color: {
      type: String,
      required: true,
      default: '#3b82f6', // blue-500
    },
    logo: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['planning', 'in-development', 'launched', 'in-review', 'completed'],
      default: 'planning',
    },
    endDate: {
      type: Date,
      required: false,
    },
    estimatedHours: {
      type: Number,
      min: 0,
    },
    assignedTo: {
      type: String,
      trim: true,
    },
    assignedToEmployeeId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
    },
    assignedToEmployeeIds: {
      type: [Schema.Types.ObjectId],
      ref: 'Employee',
      default: [],
    },
    assignedToNames: {
      type: [String],
      default: [],
    },
    // Keep stages for backward compatibility during migration
    stages: [
      {
        name: {
          type: String,
          required: true,
          trim: true,
        },
        description: {
          type: String,
          trim: true,
        },
        startDate: {
          type: Date,
          required: true,
        },
        endDate: {
          type: Date,
          required: true,
        },
        estimatedHours: {
          type: Number,
          min: 0,
        },
        assignedTo: {
          type: String,
          trim: true,
        },
        status: {
          type: String,
          enum: ['planning', 'in-development', 'launched', 'in-review', 'active', 'complete'],
          default: 'planning',
        },
      },
    ],
    tasks: [
      {
        name: {
          type: String,
          required: true,
          trim: true,
        },
        description: {
          type: String,
          trim: true,
        },
        startDate: {
          type: Date,
          required: true,
        },
        endDate: {
          type: Date,
          required: true,
        },
        estimatedHours: {
          type: Number,
          min: 0,
        },
        assignedTo: {
          type: String,
          trim: true,
        },
        assignedToEmployeeId: {
          type: Schema.Types.ObjectId,
          ref: 'Employee',
        },
        status: {
          type: String,
          enum: ['active', 'completed', 'in-review'],
          default: 'active',
        },
      },
    ],
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Migration logic has been moved to src/lib/utils/apiHelpers.ts

// Add indexes for better query performance
ProjectSchema.index({ userId: 1 });
ProjectSchema.index({ status: 1 });
ProjectSchema.index({ projectType: 1 });
ProjectSchema.index({ assignedToEmployeeId: 1 });
ProjectSchema.index({ assignedToEmployeeIds: 1 });
ProjectSchema.index({ 'tasks.assignedToEmployeeId': 1 });
ProjectSchema.index({ createdAt: -1 });

const Project: Model<IProject> = mongoose.models.Project || mongoose.model<IProject>('Project', ProjectSchema);

export default Project;
