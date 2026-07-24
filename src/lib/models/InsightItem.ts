import mongoose, { Schema, Document, Model, Types } from 'mongoose';

interface IInsightItem extends Document {
  categoryId: Types.ObjectId;
  title: string;
  description: string;
  itemOrder: number;
  detectsFromCategorySlug?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const InsightItemSchema = new Schema<IInsightItem>(
  {
    categoryId: { type: Schema.Types.ObjectId, ref: 'InsightCategory', required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    itemOrder: { type: Number, required: true, default: 0 },
    detectsFromCategorySlug: { type: String, trim: true, lowercase: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

InsightItemSchema.index({ categoryId: 1, itemOrder: 1 });

const InsightItem: Model<IInsightItem> =
  mongoose.models.InsightItem || mongoose.model<IInsightItem>('InsightItem', InsightItemSchema);

export default InsightItem;
