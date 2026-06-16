import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const AvailabilitySlotSchema = new Schema(
  {
    dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
    startTime: { type: String, required: true, trim: true },
    endTime: { type: String, required: true, trim: true },
    enabled: { type: Boolean, default: true },
  },
  { _id: false }
);

const OnboardingHostSchema = new Schema(
  {
    id: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    name: { type: String, default: '', trim: true },
    timezone: { type: String, default: 'America/New_York', trim: true },
    slots: { type: [AvailabilitySlotSchema], default: [] },
    active: { type: Boolean, default: true },
    lastAssignedAt: { type: Date },
  },
  { _id: false }
);

const PlatformOnboardingSettingsSchema = new Schema(
  {
    singletonKey: { type: String, default: 'default', unique: true },
    durationMinutes: { type: Number, default: 30, min: 15, max: 120 },
    minAdvanceHours: { type: Number, default: 24, min: 0 },
    maxAdvanceDays: { type: Number, default: 30, min: 1, max: 90 },
    hosts: { type: [OnboardingHostSchema], default: [] },
  },
  { timestamps: true }
);

export type PlatformOnboardingSettingsDoc = InferSchemaType<
  typeof PlatformOnboardingSettingsSchema
> & {
  _id: mongoose.Types.ObjectId;
};

export const PlatformOnboardingSettingsModel: mongoose.Model<PlatformOnboardingSettingsDoc> =
  (mongoose.models.PlatformOnboardingSettings as
    | mongoose.Model<PlatformOnboardingSettingsDoc>
    | undefined) ??
  mongoose.model<PlatformOnboardingSettingsDoc>(
    'PlatformOnboardingSettings',
    PlatformOnboardingSettingsSchema
  );

export async function getPlatformOnboardingSettings(): Promise<PlatformOnboardingSettingsDoc> {
  const existing = await PlatformOnboardingSettingsModel.findOne({ singletonKey: 'default' });
  if (existing) return existing;
  return PlatformOnboardingSettingsModel.create({ singletonKey: 'default' });
}
