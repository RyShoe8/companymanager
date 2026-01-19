import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type EmployeeType = 'full-time' | 'part-time' | 'contractor';
export type EmployeeRole = 'Administrator' | 'Manager' | 'User';
export type EmployeeTeam = 'Development' | 'Marketing' | 'Testing';

export interface IEmployee extends Document {
  name: string;
  role: EmployeeRole; // Required: Administrator or User
  jobTitle?: string; // Optional job title (e.g., "Senior Developer", "Product Manager")
  team?: EmployeeTeam; // Optional team (Development, Marketing, Testing)
  weeklyHours: number;
  employeeType: EmployeeType;
  userId?: Types.ObjectId; // Optional - for invited employees who haven't signed up yet
  email?: string; // For invitations
  organizationId: string; // Organization identifier (userId of admin)
  createdAt: Date;
  updatedAt: Date;
}

const EmployeeSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ['Administrator', 'Manager', 'User'],
      required: true,
      default: 'User',
    },
    jobTitle: {
      type: String,
      trim: true,
    },
    team: {
      type: String,
      enum: ['Development', 'Marketing', 'Testing'],
      trim: true,
    },
    weeklyHours: {
      type: Number,
      required: true,
      min: 0,
      max: 168, // Max hours in a week
      default: 40,
    },
    employeeType: {
      type: String,
      enum: ['full-time', 'part-time', 'contractor'],
      required: true,
      default: 'full-time',
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
    },
    organizationId: {
      type: String,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

const Employee: Model<IEmployee> = mongoose.models.Employee || mongoose.model<IEmployee>('Employee', EmployeeSchema);

export default Employee;
