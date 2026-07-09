import { isAdminEmail } from '@/lib/models/User';

export function isPlatformAdmin(user: {
  isAdmin?: boolean;
  email?: string | null;
}): boolean {
  return !!(user.isAdmin || (user.email && isAdminEmail(user.email)));
}
