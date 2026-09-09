import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

const identitySchema = new Schema({
  organizationId: { type: String, required: true, immutable: true },
  name: { type: String, required: true, maxlength: 100 },
  role: { type: String, enum: ['architect', 'reviewer'], required: true, immutable: true },
  status: { type: String, enum: ['active', 'disabled', 'revoked'], default: 'disabled', required: true },
  revision: { type: Number, required: true, default: 0 },
  credentialVersion: { type: Number, required: true, default: 0 },
  grantEpoch: { type: Number, required: true, default: 0 },
  credentialHash: { type: String, select: false },
  credentialExpiresAt: Date,
  authorityFence: { type: Number, default: 0, required: true },
  createdByUserId: { type: Schema.Types.ObjectId, required: true, immutable: true },
}, { timestamps: true });
identitySchema.index({ organizationId: 1, createdAt: -1, _id: -1 });
identitySchema.index({ organizationId: 1, _id: -1 });

const grantSchema = new Schema({
  organizationId: { type: String, required: true, immutable: true },
  identityId: { type: Schema.Types.ObjectId, required: true, immutable: true },
  projectId: { type: Schema.Types.ObjectId, required: true, immutable: true },
  runId: { type: Schema.Types.ObjectId, required: true, immutable: true },
  operation: { type: String, enum: ['planning.infer', 'artifact.review'], required: true, immutable: true },
  policyDigest: { type: String, required: true, immutable: true },
  credentialVersion: { type: Number, required: true, immutable: true },
  grantEpoch: { type: Number, required: true, immutable: true },
  revision: { type: Number, required: true, default: 0 },
  revoked: { type: Boolean, required: true, default: false },
  issuedAt: { type: Date, required: true, immutable: true },
  expiresAt: { type: Date, required: true, immutable: true },
  authorityFence: { type: Number, required: true, default: 0 },
  createdByUserId: { type: Schema.Types.ObjectId, required: true, immutable: true },
}, { timestamps: true });
grantSchema.index({ organizationId: 1, identityId: 1, createdAt: -1, _id: -1 });
grantSchema.index({ organizationId: 1, identityId: 1, _id: -1 });

const auditSchema = new Schema({
  organizationId: { type: String, required: true, immutable: true },
  identityId: { type: Schema.Types.ObjectId, required: true, immutable: true },
  grantId: { type: Schema.Types.ObjectId, immutable: true },
  actorUserId: { type: Schema.Types.ObjectId, required: true, immutable: true },
  action: { type: String, enum: ['registered', 'activated', 'disabled', 'revoked', 'rotated', 'grant-issued', 'grant-revoked'], required: true, immutable: true },
  revision: { type: Number, required: true, immutable: true },
}, { timestamps: { createdAt: true, updatedAt: false } });
auditSchema.index({ organizationId: 1, identityId: 1, createdAt: -1, _id: -1 });

function modelFor<T>(name: string, schema: Schema<T>): Model<T> {
  return (mongoose.models[name] as Model<T> | undefined) ?? mongoose.model<T>(name, schema);
}
export const AiServiceIdentity = modelFor<InferSchemaType<typeof identitySchema>>('AiServiceIdentity', identitySchema);
export const AiServiceGrant = modelFor<InferSchemaType<typeof grantSchema>>('AiServiceGrant', grantSchema);
export const AiServiceIdentityAudit = modelFor<InferSchemaType<typeof auditSchema>>('AiServiceIdentityAudit', auditSchema);
