import type { EmployeeRole } from '@/lib/models/Employee';

/**
 * Whether an employee role has manager-or-admin privileges.
 * Centralizes the `'Manager' | 'Administrator'` check used across
 * API routes, client hooks, and permission helpers.
 */
export function isManagerOrAdminRole(role: EmployeeRole | string | null | undefined): boolean {
  return role === 'Manager' || role === 'Administrator';
}
