import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

const evidenceSchema = new Schema({
  command: { type: [String], required: true }, exitCode: { type: Number, default: null },
  timedOut: { type: Boolean, required: true }, output: { type: String, required: true, maxlength: 16000 },
}, { _id: false });

const schema = new Schema({
  organizationId: { type: String, required: true, immutable: true },
  projectId: { type: Schema.Types.ObjectId, required: true, immutable: true },
  createdByUserId: { type: Schema.Types.ObjectId, required: true, immutable: true },
  requestId: { type: String, required: true, immutable: true },
  status: { type: String, enum: ['completed', 'blocked', 'failed'] as const, required: true },
  summary: { type: String, required: true, maxlength: 4000 },
  baseCommit: { type: String, required: true, maxlength: 40 },
  patch: { type: Buffer, required: true, select: false },
  changedFiles: { type: [String], required: true },
  evidence: { type: [evidenceSchema], required: true },
  limitations: { type: [String], required: true },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });
schema.index({ organizationId: 1, projectId: 1, createdAt: -1 });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

type Doc = InferSchemaType<typeof schema>;
export const AiIdeExecutionArtifact = (mongoose.models.AiIdeExecutionArtifact as Model<Doc> | undefined) ?? mongoose.model<Doc>('AiIdeExecutionArtifact', schema);
