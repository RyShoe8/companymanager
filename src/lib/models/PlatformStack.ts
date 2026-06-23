import mongoose, { Schema, Document, Model } from 'mongoose';

export type PlatformLinkingMode = 'catalog' | 'url';

export interface IPlatformStack extends Document {
  slug: string;
  label: string;
  displayOrder: number;
  isActive: boolean;
  iconFolder?: string;
  linkingMode: PlatformLinkingMode;
  createdAt: Date;
  updatedAt: Date;
}

const PlatformStackSchema = new Schema<IPlatformStack>(
  {
    slug: { type: String, required: true, trim: true, lowercase: true, unique: true },
    label: { type: String, required: true, trim: true },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    iconFolder: { type: String, trim: true },
    linkingMode: { type: String, enum: ['catalog', 'url'], default: 'catalog' },
  },
  { timestamps: true }
);

PlatformStackSchema.index({ displayOrder: 1 });

const PlatformStack: Model<IPlatformStack> =
  mongoose.models.PlatformStack ||
  mongoose.model<IPlatformStack>('PlatformStack', PlatformStackSchema);

export default PlatformStack;
