import connectDB from '@/lib/db/mongodb';
import Organization from '@/lib/models/Organization';
import Employee from '@/lib/models/Employee';
import { createBrevoContact } from '@/lib/services/email';

/** Resolve display name for an org from Organization doc (keyed by admin userId). */
export async function getOrganizationName(organizationId: string): Promise<string | undefined> {
  if (!organizationId) return undefined;
  await connectDB();
  const org = await Organization.findOne({ userId: organizationId }).select('name').lean();
  const name = org?.name?.trim();
  return name || undefined;
}

export type SyncUserToBrevoOptions = {
  email: string;
  name?: string;
  organizationId?: string;
  organizationName?: string;
  role?: string;
  jobTitle?: string;
  employeeType?: string;
};

/**
 * Create or update a Brevo contact on list #3 (Users) with standard Nucleas attributes.
 * Safe to call fire-and-forget — errors are logged, not thrown.
 */
export async function syncUserToBrevo(options: SyncUserToBrevoOptions): Promise<void> {
  let organizationName = options.organizationName?.trim();
  if (!organizationName && options.organizationId) {
    organizationName = await getOrganizationName(options.organizationId);
  }

  const attributes: Record<string, string> = {};
  if (organizationName) attributes.ORGANIZATION = organizationName;
  if (options.role) attributes.ROLE = options.role;
  if (options.jobTitle) attributes.JOB_TITLE = options.jobTitle;
  if (options.employeeType) attributes.EMPLOYEE_TYPE = options.employeeType;

  await createBrevoContact({
    email: options.email,
    name: options.name,
    attributes,
  });
}

/** Fire-and-forget wrapper for auth/setup routes. */
export function syncUserToBrevoInBackground(options: SyncUserToBrevoOptions): void {
  void syncUserToBrevo(options).catch((error) => {
    console.error('[brevo] syncUserToBrevo failed', { email: options.email, error });
  });
}

/** Resolve role/job fields from Employee when syncing an invited user who just registered. */
export async function syncRegisteredUserToBrevo(options: {
  email: string;
  name?: string;
  organizationId: string;
  userId: string;
}): Promise<void> {
  await connectDB();
  const employee = await Employee.findOne({
    userId: options.userId,
    organizationId: options.organizationId,
  })
    .select('role jobTitle employeeType')
    .lean();

  await syncUserToBrevo({
    email: options.email,
    name: options.name,
    organizationId: options.organizationId,
    role: employee?.role,
    jobTitle: employee?.jobTitle,
    employeeType: employee?.employeeType,
  });
}

export function syncRegisteredUserToBrevoInBackground(options: {
  email: string;
  name?: string;
  organizationId: string;
  userId: string;
}): void {
  void syncRegisteredUserToBrevo(options).catch((error) => {
    console.error('[brevo] syncRegisteredUserToBrevo failed', { email: options.email, error });
  });
}
