import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IInsightVendor extends Document {
  itemId: Types.ObjectId;
  name: string;
  description: string;
  pricing: string;
  url: string;
  vendorSlug: string;
  isAffiliate: boolean;
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const InsightVendorSchema = new Schema<IInsightVendor>(
  {
    itemId: { type: Schema.Types.ObjectId, ref: 'InsightItem', required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    pricing: { type: String, default: '', trim: true },
    url: { type: String, required: true, trim: true },
    vendorSlug: { type: String, required: true, trim: true, lowercase: true },
    isAffiliate: { type: Boolean, default: false },
    displayOrder: { type: Number, required: true, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

InsightVendorSchema.index({ vendorSlug: 1 }, { unique: true });
InsightVendorSchema.index({ itemId: 1, displayOrder: 1 });

const InsightVendor: Model<IInsightVendor> =
  mongoose.models.InsightVendor || mongoose.model<IInsightVendor>('InsightVendor', InsightVendorSchema);

export default InsightVendor;
