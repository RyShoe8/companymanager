import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { restoreAssignmentsForEmployee } from '@/lib/utils/restoreAssignments';

/**
 * POST /api/admin/restore-assignments
 * Restore assignments for a specific employee by name
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
      return NextResponse.json({ error: 'Only Administrators can restore assignments' }, { status: 403 });
    }

    const body = await request.json();
    const { employeeName } = body;

    if (!employeeName) {
      return NextResponse.json({ error: 'employeeName is required' }, { status: 400 });
    }

    const result = await restoreAssignmentsForEmployee(employeeName, user.organizationId);

    return NextResponse.json({
      message: 'Assignments restored successfully',
      ...result
    });
  } catch (error: any) {
    console.error('Restoration error:', error);
    return NextResponse.json({ error: error.message || 'Restoration failed' }, { status: 500 });
  }
}
