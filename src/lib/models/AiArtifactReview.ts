import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

const scope = {
  organizationId: { type: String, required: true, immutable: true },
  projectId: { type: Schema.Types.ObjectId, required: true, immutable: true },
  taskId: { type: Schema.Types.ObjectId, required: true, immutable: true },
  runId: { type: Schema.Types.ObjectId, required: true, immutable: true },
};
const evidenceSchema = new Schema({
  digest: { type: String, required: true, immutable: true },
  bytes: { type: Buffer, required: true, immutable: true, select: false },
}, { _id: false });
const artifactSchema = new Schema({
  ...scope,
  binding: { type: Schema.Types.Mixed, required: true, immutable: true },
  bindingDigest: { type: String, required: true, immutable: true },
  workerIdentityId: { type: Schema.Types.ObjectId, required: true, immutable: true },
  projectUpdatedAt: { type: Date, required: true, immutable: true },
  patch: { type: Buffer, required: true, immutable: true, select: false },
  evidence: { type: [evidenceSchema], required: true, immutable: true },
  // No product API or current persistence function can promote this flag.
  executionVerified: { type: Boolean, required: true, default: false, immutable: true },
}, { timestamps: { createdAt: true, updatedAt: false } });
artifactSchema.index({ organizationId: 1, projectId: 1, runId: 1, bindingDigest: 1 }, { unique: true });
artifactSchema.index({ organizationId: 1, projectId: 1, _id: -1 });

const reviewSchema = new Schema({
  ...scope,
  artifactId: { type: Schema.Types.ObjectId, required: true, immutable: true },
  payload: { type: Schema.Types.Mixed, required: true, immutable: true },
  payloadDigest: { type: String, required: true, immutable: true },
  reviewerIdentityId: { type: Schema.Types.ObjectId, required: true, immutable: true },
  credentialVersion: { type: Number, required: true, immutable: true },
  grantEpoch: { type: Number, required: true, immutable: true },
  grantId: { type: Schema.Types.ObjectId, required: true, immutable: true },
  grantRevision: { type: Number, required: true, immutable: true },
}, { timestamps: { createdAt: true, updatedAt: false } });
reviewSchema.index({ organizationId: 1, projectId: 1, artifactId: 1, _id: -1 });
reviewSchema.index({ organizationId: 1, projectId: 1, artifactId: 1, createdAt: -1, _id: -1 });

const acceptanceSchema = new Schema({
  ...scope,
  artifactId: { type: Schema.Types.ObjectId, required: true, immutable: true },
  reviewId: { type: Schema.Types.ObjectId, required: true, immutable: true },
  bindingDigest: { type: String, required: true, immutable: true },
  acceptedByUserId: { type: Schema.Types.ObjectId, required: true, immutable: true },
  acceptedAt: { type: Date, required: true, immutable: true },
  consumed: { type: Boolean, required: true, default: true, immutable: true },
}, { timestamps: { createdAt: true, updatedAt: false } });
acceptanceSchema.index({ organizationId: 1, runId: 1 }, { unique: true });

function modelFor<T>(name: string, schema: Schema<T>): Model<T> {
  return (mongoose.models[name] as Model<T> | undefined) ?? mongoose.model<T>(name, schema);
}
export const AiArtifact = modelFor<InferSchemaType<typeof artifactSchema>>('AiArtifact', artifactSchema);
export const AiArtifactReview = modelFor<InferSchemaType<typeof reviewSchema>>('AiArtifactReview', reviewSchema);
export const AiArtifactAcceptance = modelFor<InferSchemaType<typeof acceptanceSchema>>('AiArtifactAcceptance', acceptanceSchema);
