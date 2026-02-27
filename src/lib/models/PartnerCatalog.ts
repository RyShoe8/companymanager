import mongoose, { Schema, Document, Model, Types } from 'mongoose';

/** Partner link entry in the catalog (e.g. product, integration). */
export interface IPartnerLink {
  name: string;
  url?: string;
  productType?: string; // References productTypes taxonomy; shared with referral system
  description?: string;
}

/** Catalog of partner links and product types for Smart Buttons and referral. */
export interface IPartnerCatalog extends Document {
  name: string;
  partnerLinks: IPartnerLink[];
  productTypes: string[]; // e.g. engineering, marketing, sales, operations; shared with Section 5 referral
  userId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PartnerLinkSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    url: { type: String, trim: true },
    productType: { type: String, trim: true },
    description: { type: String, trim: true },
  },
  { _id: true }
);

const PartnerCatalogSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    partnerLinks: {
      type: [PartnerLinkSchema],
      default: [],
    },
    productTypes: {
      type: [String],
      default: [],
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

PartnerCatalogSchema.index({ userId: 1 });

const PartnerCatalog: Model<IPartnerCatalog> =
  mongoose.models.PartnerCatalog || mongoose.model<IPartnerCatalog>('PartnerCatalog', PartnerCatalogSchema);

export default PartnerCatalog;
