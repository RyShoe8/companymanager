import mongoose, { Schema, Document, Model, Types } from 'mongoose';

type ProjectInsightStatus = 'completed' | 'dismissed';

interface IProjectInsightState extends Document {
  projectId: Types.ObjectId;
  itemId: Types.ObjectId;
  status: ProjectInsightStatus;
  dismissedServiceName?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectInsightStateSchema = new Schema<IProjectInsightState>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    itemId: { type: Schema.Types.ObjectId, ref: 'InsightItem', required: true, index: true },
    status: { type: String, enum: ['completed', 'dismissed'], required: true },
    dismissedServiceName: { type: String, trim: true },
  },
  { timestamps: true }
);

ProjectInsightStateSchema.index({ projectId: 1, itemId: 1 }, { unique: true });

const ProjectInsightState: Model<IProjectInsightState> =
  mongoose.models.ProjectInsightState ||
  mongoose.model<IProjectInsightState>('ProjectInsightState', ProjectInsightStateSchema);

export default ProjectInsightState;
