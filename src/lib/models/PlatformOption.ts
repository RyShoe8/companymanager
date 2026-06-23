import mongoose, { Schema, Document, Model } from 'mongoose';
import type { PlatformStackSlug } from '@/lib/models/PlatformCategory';

export interface IPlatformOption extends Document {
  stackType: PlatformStackSlug;
  optionId: string;
  categorySlug: string;
  name: string;
  homepageUrl: string;
  simpleIconSlug?: string;
  iconExtension: 'svg' | 'png';
  iconUrl?: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PlatformOptionSchema = new Schema<IPlatformOption>(
  {
    stackType: { type: String, required: true, trim: true, lowercase: true },
    optionId: { type: String, required: true, trim: true, lowercase: true },
    categorySlug: { type: String, required: true, trim: true, lowercase: true },
    name: { type: String, required: true, trim: true },
    homepageUrl: { type: String, required: true, trim: true },
    simpleIconSlug: { type: String, trim: true },
    iconExtension: { type: String, enum: ['svg', 'png'], default: 'svg' },
    iconUrl: { type: String, trim: true },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

PlatformOptionSchema.index({ stackType: 1, optionId: 1 }, { unique: true });
PlatformOptionSchema.index({ stackType: 1, categorySlug: 1, displayOrder: 1 });

const PlatformOption: Model<IPlatformOption> =
  mongoose.models.PlatformOption ||
  mongoose.model<IPlatformOption>('PlatformOption', PlatformOptionSchema);

export default PlatformOption;
