import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type WireframeSourceType = 'builtin' | 'external';

export type SectionType = 'header' | 'footer' | 'nav' | 'content';
export type ComponentType = 'button' | 'form' | 'image' | 'text' | 'container' | 'link' | 'logo' | 'user-menu';

export interface IWireframeComponent {
  id: string;
  type: ComponentType;
  label: string;
  functionality?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  props?: Record<string, any>;
  linkedPageId?: string;
}

export interface IWireframeSection {
  id: string;
  type: SectionType;
  label: string;
  description?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  components: IWireframeComponent[];
  props?: Record<string, any>;
}

export interface IWireframePage {
  id: string;
  name: string;
  path: string;
  sections: IWireframeSection[];
  components?: IWireframeComponent[]; // Components stored at page level, independent of sections
  x?: number; // Optional position for structure view
  y?: number; // Optional position for structure view
}

export interface IWireframeConnection {
  fromPageId: string;
  toPageId: string;
  label?: string;
}

export interface IWireframe extends Document {
  projectId: Types.ObjectId;
  sourceType: WireframeSourceType;
  externalUrl?: string;
  pages: IWireframePage[];
  connections: IWireframeConnection[];
  metadata?: {
    version?: number;
    lastEditedBy?: Types.ObjectId;
  };
  userId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const WireframeComponentSchema = new Schema({
  id: { type: String, required: true },
  type: {
    type: String,
    enum: ['button', 'form', 'image', 'text', 'container', 'link', 'logo', 'user-menu'],
    required: true,
  },
  label: { type: String, required: true },
  functionality: { type: String },
  x: { type: Number, required: true, default: 0 },
  y: { type: Number, required: true, default: 0 },
  width: { type: Number, required: true, default: 100 },
  height: { type: Number, required: true, default: 50 },
  props: { type: Schema.Types.Mixed, default: {} },
  linkedPageId: { type: String },
}, { _id: false });

const WireframeSectionSchema = new Schema({
  id: { type: String, required: true },
  type: {
    type: String,
    enum: ['header', 'footer', 'nav', 'content'],
    required: true,
  },
  label: { type: String, required: true },
  description: { type: String },
  x: { type: Number, required: true, default: 0 },
  y: { type: Number, required: true, default: 0 },
  width: { type: Number, required: true, default: 100 },
  height: { type: Number, required: true, default: 50 },
  components: { type: [WireframeComponentSchema], default: [] },
  props: { type: Schema.Types.Mixed, default: {} },
}, { _id: false });

const WireframePageSchema = new Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  path: { type: String, required: true },
  sections: { type: [WireframeSectionSchema], default: [] },
  components: { type: [WireframeComponentSchema], default: [] }, // Components at page level
  x: { type: Number, required: false },
  y: { type: Number, required: false },
}, { _id: false });

const WireframeConnectionSchema = new Schema({
  fromPageId: { type: String, required: true },
  toPageId: { type: String, required: true },
  label: { type: String },
}, { _id: false });

const WireframeSchema: Schema = new Schema(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    sourceType: {
      type: String,
      enum: ['builtin', 'external'],
      required: true,
    },
    externalUrl: {
      type: String,
      trim: true,
    },
    pages: {
      type: [WireframePageSchema],
      default: [],
    },
    connections: {
      type: [WireframeConnectionSchema],
      default: [],
    },
    metadata: {
      version: { type: Number, default: 1 },
      lastEditedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Add indexes for better query performance
WireframeSchema.index({ projectId: 1 });
WireframeSchema.index({ userId: 1 });
WireframeSchema.index({ sourceType: 1 });
WireframeSchema.index({ createdAt: -1 });

const Wireframe: Model<IWireframe> =
  mongoose.models.Wireframe || mongoose.model<IWireframe>('Wireframe', WireframeSchema);

export default Wireframe;
