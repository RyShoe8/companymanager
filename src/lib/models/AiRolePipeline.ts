import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

function modelFor<T>(name: string, definition: Schema<T>): Model<T> {
  return (mongoose.models[name] as Model<T> | undefined) ?? mongoose.model<T>(name, definition);
}

const profileSchema = new Schema(
  {
    key: { type: String, required: true, maxlength: 64 },
    label: { type: String, required: true, maxlength: 120 },
    provider: {
      type: String,
      enum: [
        'openai',
        'anthropic',
        'google',
        'groq',
        'deepseek',
        'together',
        'fireworks',
        'openrouter',
        'custom',
      ] as const,
      default: 'custom',
    },
    tier: { type: String, enum: ['commercial', 'local_remote'] as const, required: true },
    protocol: { type: String, enum: ['openai-chat'] as const, required: true, default: 'openai-chat' },
    endpoint: { type: String, required: true, maxlength: 2048 },
    /** Optional legacy default; live model is chosen per pipeline stage. Empty is allowed. */
    model: { type: String, required: false, maxlength: 200, default: '' },
    secretCiphertext: { type: String, required: true, maxlength: 16000 },
    secretLast4: { type: String, required: true, maxlength: 8 },
    /** Admin-entered available balance when the provider has no live balance API. */
    manualBalanceMicros: { type: Number, required: false, min: 0, default: null },
    manualBalanceUpdatedAt: { type: Date, required: false, default: null },
    enabled: { type: Boolean, required: true, default: true },
    updatedByUserId: { type: Schema.Types.ObjectId },
  },
  { timestamps: true }
);

profileSchema.index({ key: 1 }, { unique: true });

export type AiModelProfileDoc = InferSchemaType<typeof profileSchema>;
export const AiModelProfile = modelFor<AiModelProfileDoc>('AiModelProfile', profileSchema);

const stageSchema = new Schema(
  {
    modelProfileId: { type: Schema.Types.ObjectId, required: true, ref: 'AiModelProfile' },
    /** Catalog or custom model id used at invoke time for this stage. */
    model: { type: String, required: true, maxlength: 200, default: '' },
  },
  { _id: false }
);

const pipelineSchema = new Schema(
  {
    organizationId: { type: String, required: true, immutable: true },
    employee: {
      type: String,
      enum: ['marketing', 'product', 'support', 'engineering', 'researcher'] as const,
      required: true,
    },
    planner: { type: stageSchema, required: true },
    worker: { type: stageSchema, required: true },
    reviewer: { type: stageSchema, required: true },
    maxSubtasks: { type: Number, required: true, default: 5, min: 1, max: 8 },
    maxWorkerRetries: { type: Number, required: true, default: 1, min: 0, max: 2 },
    enabled: { type: Boolean, required: true, default: true },
    updatedByUserId: { type: Schema.Types.ObjectId },
  },
  { timestamps: true }
);

pipelineSchema.index({ organizationId: 1, employee: 1 }, { unique: true });

export type AiRolePipelineDoc = InferSchemaType<typeof pipelineSchema>;
export const AiRolePipeline = modelFor<AiRolePipelineDoc>('AiRolePipeline', pipelineSchema);

const runSchema = new Schema(
  {
    organizationId: { type: String, required: true, immutable: true },
    projectId: { type: Schema.Types.ObjectId, required: true, immutable: true },
    employee: {
      type: String,
      enum: ['marketing', 'product', 'support', 'engineering', 'researcher'] as const,
      required: true,
    },
    brief: { type: String, required: true, maxlength: 6000 },
    status: {
      type: String,
      enum: ['running', 'completed', 'blocked', 'cancelled'] as const,
      required: true,
      default: 'running',
    },
    summary: { type: String, maxlength: 4000, default: '' },
    createdByUserId: { type: Schema.Types.ObjectId, required: true },
    totalCostMicros: { type: Number, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

runSchema.index({ organizationId: 1, projectId: 1, createdAt: -1 });

export type AiPipelineRunDoc = InferSchemaType<typeof runSchema>;
export const AiPipelineRun = modelFor<AiPipelineRunDoc>('AiPipelineRun', runSchema);

const stageEventSchema = new Schema(
  {
    organizationId: { type: String, required: true, immutable: true },
    projectId: { type: Schema.Types.ObjectId, required: true, immutable: true },
    pipelineRunId: { type: Schema.Types.ObjectId, required: true, ref: 'AiPipelineRun' },
    sequence: { type: Number, required: true, min: 1 },
    stage: { type: String, enum: ['planner', 'worker', 'reviewer'] as const, required: true },
    status: {
      type: String,
      enum: ['running', 'completed', 'blocked', 'cancelled'] as const,
      required: true,
    },
    modelProfileId: { type: Schema.Types.ObjectId, ref: 'AiModelProfile' },
    modelLabel: { type: String, maxlength: 120 },
    modelTier: { type: String, enum: ['commercial', 'local_remote'] as const, default: null },
    subtaskId: { type: String, maxlength: 64, default: null },
    summary: { type: String, maxlength: 4000, default: '' },
    failureCode: { type: String, maxlength: 64, default: null },
    costMicros: { type: Number, default: null },
    reservedMicros: { type: Number, default: null },
    noProviderFee: { type: Boolean, default: false },
    aiRunId: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true }
);

stageEventSchema.index({ pipelineRunId: 1, sequence: 1 }, { unique: true });

export type AiPipelineStageEventDoc = InferSchemaType<typeof stageEventSchema>;
export const AiPipelineStageEvent = modelFor<AiPipelineStageEventDoc>(
  'AiPipelineStageEvent',
  stageEventSchema
);
