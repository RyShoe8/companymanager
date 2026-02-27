import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type ReferralCategory = 'Plan' | 'Build' | 'Run';
export type ProjectTypeFilter = 'website' | 'store' | 'app' | 'generic';

/** Single entry in the referral catalog (company/tool for checklist and Add flow). */
export interface IReferralCatalogEntry {
  companyName: string;
  /** Optional manual category name (e.g. "Hosting", "Analytics"). */
  categoryName?: string;
  /** Phase where this appears in the smart button: Plan, Build, or Run. */
  category: ReferralCategory;
  checklistSentence?: string;
  checklistNumber?: number;
  url?: string;
  /** Optional icon/image URL for the button category (e.g. from Stage Management upload). */
  imageUrl?: string;
  projectTypes?: ProjectTypeFilter[];
}

/** Referral catalog document - org-level, one per organization. */
export interface IReferralCatalog extends Document {
  entries: IReferralCatalogEntry[];
  organizationId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ReferralCatalogEntrySchema = new Schema(
  {
    companyName: { type: String, required: true, trim: true },
    categoryName: { type: String, trim: true },
    category: { type: String, required: true, enum: ['Plan', 'Build', 'Run'] },
    checklistSentence: { type: String, trim: true },
    checklistNumber: { type: Number, min: 0 },
    url: { type: String, trim: true },
    imageUrl: { type: String, trim: true },
    projectTypes: { type: [String], enum: ['website', 'store', 'app', 'generic'], default: [] },
  },
  { _id: true }
);

const ReferralCatalogSchema: Schema = new Schema(
  {
    entries: {
      type: [ReferralCatalogEntrySchema],
      default: [],
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
  },
  { timestamps: true }
);

ReferralCatalogSchema.index({ organizationId: 1 }, { unique: true });

const ReferralCatalog: Model<IReferralCatalog> =
  mongoose.models.ReferralCatalog ||
  mongoose.model<IReferralCatalog>('ReferralCatalog', ReferralCatalogSchema);

export default ReferralCatalog;
