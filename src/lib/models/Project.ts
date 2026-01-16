import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type TimeframeType = 'today' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
export type ProjectStatus = 'planning' | 'active' | 'in-review' | 'complete';

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
  url?: string;
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
    url: {
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
      enum: ['today', 'weekly', 'monthly', 'quarterly', 'yearly'],
      required: true,
    },
    color: {
      type: String,
      required: true,
      default: '#347AF6', // Nucleus Blue
    },
    status: {
      type: String,
      enum: ['planning', 'active', 'in-review', 'complete'],
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

// Helper function to calculate estimated hours from incomplete stages
function calculateEstimatedHoursFromStages(stages: IProjectStage[]): number | undefined {
  if (!stages || stages.length === 0) {
    return undefined;
  }
  
  const totalHours = stages
    .filter(stage => stage.status !== 'complete')
    .reduce((sum, stage) => sum + (stage.estimatedHours || 0), 0);
  
  return totalHours > 0 ? totalHours : undefined;
}

// Pre-save hook to automatically calculate estimatedHours from stages
ProjectSchema.pre('save', function(this: IProject) {
  // Only recalculate if stages exist and have at least one stage with hours
  if (this.stages && this.stages.length > 0) {
    const hasStagesWithHours = this.stages.some(stage => stage.estimatedHours && stage.estimatedHours > 0);
    
    if (hasStagesWithHours) {
      const calculatedHours = calculateEstimatedHoursFromStages(this.stages);
      // Update estimatedHours based on incomplete stages
      this.estimatedHours = calculatedHours;
    }
    // If stages exist but none have hours, keep the existing estimatedHours (manual entry)
  }
  // If no stages exist, keep the existing estimatedHours (manual entry)
});

const Project: Model<IProject> = mongoose.models.Project || mongoose.model<IProject>('Project', ProjectSchema);

export default Project;
