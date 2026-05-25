import Link from 'next/link';
import { AdminPlanForm } from 'billing-engine/next/components';

export const dynamic = 'force-dynamic';

export default function NewAdminPlanPage() {
  return (
    <div className="min-h-screen bg-background px-4 sm:px-6 lg:px-[100px] py-8">
      <div className="space-y-6">
        <Link
          href="/admin/plans"
          className="text-sm text-text-secondary underline underline-offset-4 hover:text-text-primary"
        >
          ← Plans
        </Link>
        <AdminPlanForm mode="create" />
      </div>
    </div>
  );
}
