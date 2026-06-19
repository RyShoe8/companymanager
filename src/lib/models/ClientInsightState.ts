import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type ClientInsightStatus = 'completed' | 'dismissed';

export interface IClientInsightState extends Document {
  clientId: Types.ObjectId;
  itemId: Types.ObjectId;
  status: ClientInsightStatus;
  dismissedServiceName?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ClientInsightStateSchema = new Schema<IClientInsightState>(
  {
    clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
    itemId: { type: Schema.Types.ObjectId, ref: 'InsightItem', required: true, index: true },
    status: { type: String, enum: ['completed', 'dismissed'], required: true },
    dismissedServiceName: { type: String, trim: true },
  },
  { timestamps: true }
);

ClientInsightStateSchema.index({ clientId: 1, itemId: 1 }, { unique: true });

const ClientInsightState: Model<IClientInsightState> =
  mongoose.models.ClientInsightState ||
  mongoose.model<IClientInsightState>('ClientInsightState', ClientInsightStateSchema);

export default ClientInsightState;
