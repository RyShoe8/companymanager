import mongoose, { Schema } from 'mongoose';

const schema = new Schema({
  organizationId: { type: String, required: true },
  projectId: { type: Schema.Types.ObjectId, required: true },
  createdByUserId: { type: Schema.Types.ObjectId, required: true },
  requestId: { type: String, required: true },
  employee: { type: String, enum: ['marketing', 'product', 'support', 'engineering', 'researcher'], required: true },
  kind: { type: String, enum: ['message', 'task'], required: true },
  /** Conversation role. Legacy rows without role are treated as user. */
  role: { type: String, enum: ['user', 'assistant', 'status'], default: 'user', required: true },
  text: { type: String, required: true, maxlength: 6000 },
  cadence: { type: String, enum: ['once', 'daily', 'weekly'], required: true },
  status: { type: String, enum: ['saved', 'cancelled'], default: 'saved', required: true },
  /** Optional link from assistant/status turns back to the user requestId. */
  parentRequestId: { type: String },
  /** Durable once-only claim; interrupted replies must not be automatically replayed. */
  replyAttemptedAt: Date,
  failureCategory: { type: String, maxlength: 64 },
  runId: { type: String, maxlength: 64 },
}, { timestamps: true });

schema.index({ organizationId: 1, projectId: 1, createdByUserId: 1, requestId: 1 }, { unique: true });
schema.index({ organizationId: 1, projectId: 1, createdByUserId: 1, _id: -1 });
schema.index({ organizationId: 1, createdByUserId: 1, kind: 1, _id: -1 });

export const AiTeamRequest = mongoose.models.AiTeamRequest ?? mongoose.model('AiTeamRequest', schema);
