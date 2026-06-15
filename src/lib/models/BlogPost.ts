import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type BlogPostStatus = 'draft' | 'published';

export interface IBlogPost extends Document {
  slug: string;
  title: string;
  excerpt?: string;
  bodyHtml: string;
  status: BlogPostStatus;
  publishedAt?: Date;
  authorId: Types.ObjectId;
  coverImageUrl?: string;
  metaTitle?: string;
  metaDescription?: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const BlogPostSchema = new Schema<IBlogPost>(
  {
    slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 200 },
    title: { type: String, required: true, trim: true, maxlength: 300 },
    excerpt: { type: String, trim: true, maxlength: 500 },
    bodyHtml: { type: String, default: '' },
    status: { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
    publishedAt: { type: Date },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    coverImageUrl: { type: String, trim: true, maxlength: 500 },
    metaTitle: { type: String, trim: true, maxlength: 300 },
    metaDescription: { type: String, trim: true, maxlength: 500 },
    tags: { type: [String], default: [] },
  },
  { timestamps: true }
);

BlogPostSchema.index({ slug: 1 }, { unique: true });
BlogPostSchema.index({ status: 1, publishedAt: -1 });

const BlogPost: Model<IBlogPost> =
  mongoose.models.BlogPost || mongoose.model<IBlogPost>('BlogPost', BlogPostSchema);

export default BlogPost;
