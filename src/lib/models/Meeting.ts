import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IMeeting extends Document {
  userId: Types.ObjectId;
  organizationId: string;
  title: string;
  start: Date;
  end: Date;
  googleEventId?: string;
  agendaToken: string;
  linkedProjectIds: Types.ObjectId[];
  createdInNucleas: boolean;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const MeetingSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    organizationId: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true },
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    googleEventId: { type: String, trim: true, sparse: true },
    agendaToken: { type: String, required: true, unique: true, index: true },
    linkedProjectIds: [{ type: Schema.Types.ObjectId, ref: 'Project' }],
    createdInNucleas: { type: Boolean, default: true },
    description: { type: String, trim: true },
  },
  { timestamps: true }
);

MeetingSchema.index({ userId: 1, start: 1 });

const Meeting: Model<IMeeting> =
  mongoose.models.Meeting || mongoose.model<IMeeting>('Meeting', MeetingSchema);

export default Meeting;
