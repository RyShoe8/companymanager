import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

const schema = new Schema(
  {
    organizationId: { type: String, required: true, immutable: true },
    projectId: { type: Schema.Types.ObjectId, required: true, immutable: true },
    host: { type: String, enum: ['github'] as const, required: true, default: 'github' },
    owner: { type: String, required: true, maxlength: 100 },
    repo: { type: String, required: true, maxlength: 100 },
    defaultBranch: { type: String, required: true, maxlength: 200, default: 'main' },
    publishMode: {
      type: String,
      enum: ['pull_request'] as const,
      required: true,
      default: 'pull_request',
    },
    /** GitHub App installation id when connected; null until App install exists. */
    installationId: { type: String, maxlength: 64, default: null },
    updatedByUserId: { type: Schema.Types.ObjectId },
  },
  { timestamps: true }
);

schema.index({ organizationId: 1, projectId: 1 }, { unique: true });

function modelFor<T>(name: string, definition: Schema<T>): Model<T> {
  return (mongoose.models[name] as Model<T> | undefined) ?? mongoose.model<T>(name, definition);
}

export type AiProjectRepositoryDoc = InferSchemaType<typeof schema>;
export const AiProjectRepository = modelFor<AiProjectRepositoryDoc>('AiProjectRepository', schema);
