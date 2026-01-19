import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type TimeframeType = 'today' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
export type ProjectStatus = 'planning' | 'in-development' | 'launched' | 'in-review' | 'completed';
export type TaskStatus = 'planning' | 'active' | 'in-review' | 'complete';

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
  startDate: Date;
  endDate: Date;
  timeframeType: TimeframeType;
  color: string;
  status: ProjectStatus;
  estimatedHours?: number;
  assignedTo?: string; // Legacy - kept for backward compatibility
  assignedToEmployeeId?: Types.ObjectId; // New field using employee ID
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
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    timeframeType: {
      type: String,
      enum: ['today', 'weekly', 'monthly', 'quarterly', 'yearly'],
      required: true,
    },
    color: {
      type: String,
      required: true,
      default: '#3b82f6', // blue-500
    },
    status: {
      type: String,
      enum: ['planning', 'in-development', 'launched', 'in-review', 'completed'],
      default: 'planning',
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
          enum: ['planning', 'active', 'in-review', 'complete'],
          default: 'planning',
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

const Project: Model<IProject> = mongoose.models.Project || mongoose.model<IProject>('Project', ProjectSchema);

export default Project;
