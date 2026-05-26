import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type ProjectStatus = 'planning' | 'in-development' | 'launched' | 'in-review' | 'completed';
export type ProjectType = 'internal' | 'client';
export type ProjectCategory = 'website' | 'store' | 'app' | 'generic';
export type TaskStatus = 'active' | 'completed' | 'in-review';

export type SocialNetwork =
  | 'x'
  | 'linkedin'
  | 'instagram'
  | 'tiktok'
  | 'reddit'
  | 'bluesky'
  | 'youtube'
  | 'facebook'
  | 'github'
  | 'other';

export interface IProjectSocialLink {
  network: SocialNetwork;
  url: string;
}

export interface IProjectTask {
  _id?: Types.ObjectId; // Mongoose adds by default; use for stable task references (project.tasks.id(taskId))
  name: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  estimatedHours?: number;
  assignedTo?: string; // Legacy - kept for backward compatibility
  assignedToEmployeeId?: Types.ObjectId; // Legacy single assignment (synced from first in array)
  assignedToEmployeeIds?: Types.ObjectId[];
  status?: TaskStatus;
  /** Shared id when created as part of a recurring series (instance generation). */
  recurrenceSeriesId?: string;
}

export type ProjectActionButtonKind = 'link' | 'email';

/** Smart button on a project (Available vs Active lists; referralSourceId links to catalog). */
export interface IProjectActionButton {
  label: string;
  url: string;
  referralSourceId?: Types.ObjectId; // FK to PartnerCatalog or catalog entry
  /** Default/skip = normal URL link. `email` stores mailto URL + optional mailbox password. */
  kind?: ProjectActionButtonKind;
  password?: string;
}

export interface IProject extends Document {
  name: string;
  description?: string;
  url?: string; // Legacy field, kept for backward compatibility
  urls?: string[]; // New field for multiple URLs
  /** Dev / non-production deploy URL (workspace projects panel; e.g. preview or staging from git). */
  devUrl?: string;
  /** Production / live site URL (workspace projects panel). */
  liveUrl?: string;
  /** Social profile links shown after Live URL in project overview. */
  socialLinks?: IProjectSocialLink[];
  /** When false, Socials toolbar button is hidden; add via smart button instead. */
  socialsToolbarVisible?: boolean;
  projectType: ProjectType;
  category: ProjectCategory;
  color: string;
  /** Ordered palette: [0] = primary (kept in sync with `color` on save). Hex or rgb()/rgba() strings. */
  colorPalette?: string[];
  /** Ordered brand typefaces: [0] = primary font family name (or CSS font-family stack). */
  fontPalette?: string[];
  logo?: string; // Project logo URL
  status: ProjectStatus;
  endDate?: Date; // Optional end date - project stops appearing on status page after this date
  estimatedHours?: number;
  assignedTo?: string; // Legacy - kept for backward compatibility
  assignedToEmployeeId?: Types.ObjectId; // Legacy single assignment - kept for backward compatibility
  assignedToEmployeeIds?: Types.ObjectId[]; // New field for multiple assignments using employee IDs
  assignedToNames?: string[]; // New field for multiple assignments using names (for backward compatibility)
  tasks?: IProjectTask[];
  /** Smart buttons: Available vs Active; no duplicates in Active, removed from Available. */
  actionButtons?: IProjectActionButton[];
  /** Dismissed checklist template item IDs (ReferralCatalog entry IDs) - user can re-add via Add button. */
  dismissedChecklistIds?: Types.ObjectId[];
  /** Client portal: slug for URL (e.g. /portal/abc123). */
  clientPortalSlug?: string;
  /** Client portal: optional token for authenticated access. */
  clientPortalToken?: string;
  /** Emails to which a client invite was sent (display only). */
  invitedClientEmails?: string[];
  userId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    url: {
      type: String,
      trim: true,
    },
    urls: {
      type: [String],
      default: [],
    },
    devUrl: {
      type: String,
      trim: true,
    },
    liveUrl: {
      type: String,
      trim: true,
    },
    socialLinks: {
      type: [
        {
          network: {
            type: String,
            enum: ['x', 'linkedin', 'instagram', 'tiktok', 'reddit', 'bluesky', 'youtube', 'facebook', 'github', 'other'],
            required: true,
          },
          url: { type: String, trim: true, required: true },
        },
      ],
      default: [],
    },
    socialsToolbarVisible: {
      type: Boolean,
      default: true,
    },
    projectType: {
      type: String,
      enum: ['internal', 'client'],
      required: true,
      default: 'client',
    },
    category: {
      type: String,
      enum: ['website', 'store', 'app', 'generic'],
      required: true,
      default: 'generic',
    },
    color: {
      type: String,
      required: true,
      default: '#3b82f6', // blue-500
    },
    colorPalette: {
      type: [String],
      default: undefined,
    },
    fontPalette: {
      type: [String],
      default: undefined,
    },
    logo: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['planning', 'in-development', 'launched', 'in-review', 'completed'],
      default: 'planning',
    },
    endDate: {
      type: Date,
      required: false,
    },
    estimatedHours: {
      type: Number,
      min: 0,
    },
    assignedTo: {
      type: String,
      trim: true,
    },
    assignedToEmployeeId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
    },
    assignedToEmployeeIds: {
      type: [Schema.Types.ObjectId],
      ref: 'Employee',
      default: [],
    },
    assignedToNames: {
      type: [String],
      default: [],
    },
    // Keep stages for backward compatibility during migration
    stages: [
      {
        name: {
          type: String,
          required: true,
          trim: true,
        },
        description: {
          type: String,
          trim: true,
        },
        startDate: {
          type: Date,
          required: true,
        },
        endDate: {
          type: Date,
          required: true,
        },
        estimatedHours: {
          type: Number,
          min: 0,
        },
        assignedTo: {
          type: String,
          trim: true,
        },
        status: {
          type: String,
          enum: ['planning', 'in-development', 'launched', 'in-review', 'active', 'complete'],
          default: 'planning',
        },
      },
    ],
    tasks: [
      {
        name: {
          type: String,
          required: true,
          trim: true,
        },
        description: {
          type: String,
          trim: true,
        },
        startDate: {
          type: Date,
          required: true,
        },
        endDate: {
          type: Date,
          required: true,
        },
        estimatedHours: {
          type: Number,
          min: 0,
        },
        assignedTo: {
          type: String,
          trim: true,
        },
        assignedToEmployeeId: {
          type: Schema.Types.ObjectId,
          ref: 'Employee',
        },
        assignedToEmployeeIds: {
          type: [Schema.Types.ObjectId],
          ref: 'Employee',
          default: [],
        },
        status: {
          type: String,
          enum: ['active', 'completed', 'in-review'],
          default: 'active',
        },
        recurrenceSeriesId: {
          type: String,
          trim: true,
        },
      },
    ],
    actionButtons: [
      {
        label: { type: String, required: true, trim: true },
        url: { type: String, required: true, trim: true },
        referralSourceId: { type: Schema.Types.ObjectId, ref: 'PartnerCatalog' },
        kind: {
          type: String,
          enum: ['link', 'email'],
          default: 'link',
        },
        password: { type: String, trim: true },
      },
    ],
    dismissedChecklistIds: {
      type: [Schema.Types.ObjectId],
      default: [],
    },
    clientPortalSlug: { type: String, trim: true },
    clientPortalToken: { type: String, trim: true },
    invitedClientEmails: { type: [String], default: [] },
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

// Migration logic has been moved to src/lib/utils/apiHelpers.ts

// Add indexes for better query performance
ProjectSchema.index({ userId: 1 });
ProjectSchema.index({ status: 1 });
ProjectSchema.index({ projectType: 1 });
ProjectSchema.index({ assignedToEmployeeId: 1 });
ProjectSchema.index({ assignedToEmployeeIds: 1 });
ProjectSchema.index({ 'tasks.assignedToEmployeeId': 1 });
ProjectSchema.index({ 'tasks.assignedToEmployeeIds': 1 });
ProjectSchema.index({ 'socialLinks.network': 1 });
ProjectSchema.index({ createdAt: -1 });

const Project: Model<IProject> = mongoose.models.Project || mongoose.model<IProject>('Project', ProjectSchema);

export default Project;
