import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Operation from '@/lib/models/Operation';
import { requireAuth } from '@/lib/auth/middleware';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();
    const { id } = await params;

    const operation = await Operation.findOne({ _id: id, userId: session.userId });
    if (!operation) {
      return NextResponse.json({ error: 'Operation not found' }, { status: 404 });
    }

    return NextResponse.json(operation);
  } catch (error) {
    console.error('Get operation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    const body = await request.json();
    const { name, description, recurrenceType, status } = body;

    await connectDB();
    const { id } = await params;

    const operation = await Operation.findOne({ _id: id, userId: session.userId });
    if (!operation) {
      return NextResponse.json({ error: 'Operation not found' }, { status: 404 });
    }

    if (name !== undefined) operation.name = name;
    if (description !== undefined) operation.description = description;
    if (recurrenceType !== undefined) operation.recurrenceType = recurrenceType;
    if (status !== undefined) operation.status = status;

    await operation.save();

    return NextResponse.json(operation);
  } catch (error) {
    console.error('Update operation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();
    const { id } = await params;

    const operation = await Operation.findOneAndDelete({ _id: id, userId: session.userId });
    if (!operation) {
      return NextResponse.json({ error: 'Operation not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Operation deleted successfully' });
  } catch (error) {
    console.error('Delete operation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
