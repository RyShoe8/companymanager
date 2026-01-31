import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUser extends Document {
  email: string;
  password?: string; // Optional for OAuth users
  name?: string;
  profilePicture?: string; // URL to profile picture
  organizationId: string; // For MVP, this is the userId of the organization admin
  organizationSetupComplete?: boolean; // Whether organization has been set up
  authProvider?: 'google' | 'email'; // Track authentication provider
  googleId?: string; // Google OAuth ID
  isAdmin?: boolean; // System admin flag
  createdAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: function(this: IUser) {
        return !this.googleId; // Password required only if not using Google OAuth
      },
    },
    authProvider: {
      type: String,
      enum: ['google', 'email'],
      default: 'email',
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true, // Allow multiple null values
    },
    name: {
      type: String,
      trim: true,
    },
    profilePicture: {
      type: String,
      trim: true,
    },
    organizationId: {
      type: String,
      required: true,
      index: true,
    },
    organizationSetupComplete: {
      type: Boolean,
      default: false,
    },
    isAdmin: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Admin emails - single source of truth for system admins
export const ADMIN_EMAILS = ['ryanschumacher@themediashop.co', 'kellymcguire@themediashop.co'];

export function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

// Set admin users - check before save to avoid infinite loops
UserSchema.pre('save', async function(this: IUser) {
  if (isAdminEmail(this.email) && !this.isAdmin) {
    this.isAdmin = true;
  }
  
  // Auto-complete organization setup if user has organizationId but flag is false
  if (this.organizationId && !this.organizationSetupComplete) {
    this.organizationSetupComplete = true;
  }
});

const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;
