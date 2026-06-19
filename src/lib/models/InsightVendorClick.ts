import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IInsightVendorClick extends Document {
  vendorId: Types.ObjectId;
  itemId?: Types.ObjectId;
  projectId?: Types.ObjectId;
  clientId?: Types.ObjectId;
  clickedAt: Date;
}

const InsightVendorClickSchema = new Schema<IInsightVendorClick>({
  vendorId: { type: Schema.Types.ObjectId, ref: 'InsightVendor', required: true, index: true },
  itemId: { type: Schema.Types.ObjectId, ref: 'InsightItem' },
  projectId: { type: Schema.Types.ObjectId, ref: 'Project' },
  clientId: { type: Schema.Types.ObjectId, ref: 'Client' },
  clickedAt: { type: Date, default: Date.now, index: true },
});

InsightVendorClickSchema.index({ vendorId: 1, clickedAt: -1 });

const InsightVendorClick: Model<IInsightVendorClick> =
  mongoose.models.InsightVendorClick ||
  mongoose.model<IInsightVendorClick>('InsightVendorClick', InsightVendorClickSchema);

export default InsightVendorClick;
