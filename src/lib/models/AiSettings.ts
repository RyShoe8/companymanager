import mongoose, { Schema, type Model, type InferSchemaType } from 'mongoose';

const settingsSchema = new Schema({
  _id: { type: String, required: true },
  revision: { type: Number, required: true, default: 0 },
  usageFence: { type: Number, required: true, default: 0 },
  // Parsed with strict, versioned application schemas on every read/write; never stores secrets.
  value: { type: Schema.Types.Mixed, required: true },
  updatedByUserId: { type: String },
}, { timestamps: true });
const auditSchema = new Schema({
  settingsId: { type: String, required: true, index: true }, revision: { type: Number, required: true },
  userId: { type: String, required: true }, before: Schema.Types.Mixed, after: Schema.Types.Mixed,
}, { timestamps: true });
export const AiSettings = (mongoose.models.AiSettings as Model<InferSchemaType<typeof settingsSchema>>) || mongoose.model('AiSettings', settingsSchema);
export const AiSettingsAudit = (mongoose.models.AiSettingsAudit as Model<InferSchemaType<typeof auditSchema>>) || mongoose.model('AiSettingsAudit', auditSchema);
