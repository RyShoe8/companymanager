import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type TimeframeType = 'weekly' | 'monthly' | 'quarterly' | 'yearly';
export type ProjectStatus = 'planned' | 'active' | 'complete';

export interface IProjectStage {
  name: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  estimatedHours?: number;
  assignedTo?: string;
  status?: ProjectStatus;
}

export interface IProject extends Document {
  name: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  timeframeType: TimeframeType;
  color: string;
  status: ProjectStatus;
  estimatedHours?: number;
  assignedTo?: string;
  stages?: IProjectStage[];
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
      enum: ['weekly', 'monthly', 'quarterly', 'yearly'],
      required: true,
    },
    color: {
      type: String,
      required: true,
      default: '#3b82f6', // blue-500
    },
    status: {
      type: String,
      enum: ['planned', 'active', 'complete'],
      default: 'planned',
    },
    estimatedHours: {
      type: Number,
      min: 0,
    },
    assignedTo: {
      type: String,
      trim: true,
    },
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
          enum: ['planned', 'active', 'complete'],
          default: 'planned',
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

const Project: Model<IProject> = mongoose.models.Project || mongoose.model<IProject>('Project', ProjectSchema);

export default Project;
