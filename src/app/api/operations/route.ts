import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Operation from '@/lib/models/Operation';
import { requireAuth } from '@/lib/auth/middleware';

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();

    const { searchParams } = new URL(request.url);
    const recurrenceType = searchParams.get('recurrenceType');
    const status = searchParams.get('status');

    const query: any = { userId: session.userId };
    if (recurrenceType) {
      query.recurrenceType = recurrenceType;
    }
    if (status) {
      query.status = status;
    }

    const operations = await Operation.find(query).sort({ createdAt: -1 });

    return NextResponse.json(operations);
  } catch (error) {
    console.error('Get operations error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    const body = await request.json();
    const { name, description, recurrenceType, status } = body;

    if (!name || !recurrenceType) {
      return NextResponse.json({ error: 'Name and recurrenceType are required' }, { status: 400 });
    }

    await connectDB();

    const operation = await Operation.create({
      name,
      description,
      recurrenceType,
      status: status || 'planned',
      userId: session.userId,
    });

    return NextResponse.json(operation, { status: 201 });
  } catch (error) {
    console.error('Create operation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
