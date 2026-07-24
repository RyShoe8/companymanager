import mongoose, { Schema, Document, Model } from 'mongoose';

interface IInsightCategory extends Document {
  name: string;
  slug: string;
  stageOrder: number;
  icon: string;
  mapsToPlatformCategory?: string;
  createdAt: Date;
  updatedAt: Date;
}

const InsightCategorySchema = new Schema<IInsightCategory>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
    stageOrder: { type: Number, required: true, default: 0 },
    icon: { type: String, required: true, trim: true, default: 'lightbulb' },
    mapsToPlatformCategory: { type: String, trim: true, lowercase: true },
  },
  { timestamps: true }
);

InsightCategorySchema.index({ slug: 1 }, { unique: true });
InsightCategorySchema.index({ stageOrder: 1 });

const InsightCategory: Model<IInsightCategory> =
  mongoose.models.InsightCategory ||
  mongoose.model<IInsightCategory>('InsightCategory', InsightCategorySchema);

export default InsightCategory;
