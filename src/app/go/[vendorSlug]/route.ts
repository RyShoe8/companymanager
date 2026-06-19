import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import connectDB from '@/lib/db/mongodb';
import InsightVendor from '@/lib/models/InsightVendor';
import InsightVendorClick from '@/lib/models/InsightVendorClick';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ vendorSlug: string }> }
) {
  const { vendorSlug } = await params;
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  const clientId = searchParams.get('clientId');
  const itemId = searchParams.get('itemId');

  await connectDB();

  const vendor = await InsightVendor.findOne({ vendorSlug: vendorSlug.toLowerCase(), isActive: true }).lean();
  if (!vendor?.url) {
    return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
  }

  await InsightVendorClick.create({
    vendorId: vendor._id,
    itemId: itemId && Types.ObjectId.isValid(itemId) ? new Types.ObjectId(itemId) : undefined,
    projectId: projectId && Types.ObjectId.isValid(projectId) ? new Types.ObjectId(projectId) : undefined,
    clientId: clientId && Types.ObjectId.isValid(clientId) ? new Types.ObjectId(clientId) : undefined,
    clickedAt: new Date(),
  });

  return NextResponse.redirect(vendor.url, 302);
}
