import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { migrateOperationsToTasks } from '@/lib/utils/migrateOperationsToTasks';

/**
 * POST /api/admin/migrate-operations
 * Migrate existing Operations to Project Tasks
 * Only accessible by administrators
 */
export async function POST(request: NextRequest) {
    try {
        const session = await requireAuth(request);
        if (session instanceof NextResponse) return session;

        // Check if user is an administrator
        const User = (await import('@/lib/models/User')).default;
        const Employee = (await import('@/lib/models/Employee')).default;
        const user = await User.findById(session.userId);
        if (!user || !user.organizationId) {
            return NextResponse.json({ error: 'User or organization not found' }, { status: 404 });
        }

        const currentUserEmployee = await Employee.findOne({ userId: session.userId, organizationId: user.organizationId });
        if (!currentUserEmployee || currentUserEmployee.role !== 'Administrator') {
            return NextResponse.json({ error: 'Only Administrators can run migrations' }, { status: 403 });
        }

        const result = await migrateOperationsToTasks();

        return NextResponse.json({
            message: 'Operation migration completed successfully',
            ...result
        });
    } catch (error) {
        console.error('Operation migration failed:', error);
        return NextResponse.json({ error: 'Migration failed' }, { status: 500 });
    }
}
