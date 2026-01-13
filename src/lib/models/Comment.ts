import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IComment extends Document {
  content: string;
  authorId: Types.ObjectId;
  authorName: string;
  parentId?: Types.ObjectId; // For threading - references another comment
  entityType: 'project' | 'projectStage' | 'operation';
  entityId: Types.ObjectId; // ID of the project, stage, or operation
  stageIndex?: number; // For project stages - which stage in the project
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
      enum: ['project', 'projectStage', 'operation'],
      required: true,
    },
    entityId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    stageIndex: {
      type: Number,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient queries
CommentSchema.index({ entityType: 1, entityId: 1, stageIndex: 1 });

const Comment: Model<IComment> = mongoose.models.Comment || mongoose.model<IComment>('Comment', CommentSchema);

export default Comment;
