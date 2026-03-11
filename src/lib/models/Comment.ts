import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IComment extends Document {
  content: string;
  authorId: Types.ObjectId;
  authorName: string;
  parentId?: Types.ObjectId; // For threading - references another comment
  entityType: 'project' | 'projectTask';
  entityId: Types.ObjectId; // ID of the project or task
  /** @deprecated Use taskId for projectTask comments. */
  taskIndex?: number;
  /** Stable reference to project task (for entityType 'projectTask'). */
  taskId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CommentSchema: Schema = new Schema(
  {
    content: {
      type: String,
      required: true,
      trim: true,
    },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    authorName: {
      type: String,
      required: true,
      trim: true,
    },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: 'Comment',
    },
    entityType: {
      type: String,
      enum: ['project', 'projectTask'],
      required: true,
    },
    entityId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    taskIndex: {
      type: Number,
    },
    taskId: {
      type: Schema.Types.ObjectId,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient queries
CommentSchema.index({ entityType: 1, entityId: 1, taskIndex: 1 });
CommentSchema.index({ entityType: 1, entityId: 1, taskId: 1 });

const Comment: Model<IComment> = mongoose.models.Comment || mongoose.model<IComment>('Comment', CommentSchema);

export default Comment;
