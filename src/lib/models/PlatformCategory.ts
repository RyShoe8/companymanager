import mongoose, { Schema, Document, Model } from 'mongoose';

export type PlatformStackType = 'tech' | 'marketing';

export interface IPlatformCategory extends Document {
  stackType: PlatformStackType;
  slug: string;
  label: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PlatformCategorySchema = new Schema<IPlatformCategory>(
  {
    stackType: { type: String, enum: ['tech', 'marketing'], required: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
    label: { type: String, required: true, trim: true },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

PlatformCategorySchema.index({ stackType: 1, slug: 1 }, { unique: true });
PlatformCategorySchema.index({ stackType: 1, displayOrder: 1 });

const PlatformCategory: Model<IPlatformCategory> =
  mongoose.models.PlatformCategory ||
  mongoose.model<IPlatformCategory>('PlatformCategory', PlatformCategorySchema);

export default PlatformCategory;
