import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import InsightVendor from '@/lib/models/InsightVendor';
import { requireAdminInsights } from '@/lib/insights/requireAdminInsights';
import { generateUniqueVendorSlug } from '@/lib/insights/vendorSlug';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminInsights();
  if (auth.error) return auth.error;

  await connectDB();
  const { id } = await params;
  const body = await request.json();

  const vendor = await InsightVendor.findById(id);
  if (!vendor) {
    return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
  }

  if (body.name !== undefined) {
    const newName = String(body.name).trim();
    if (newName !== vendor.name) {
      vendor.vendorSlug = await generateUniqueVendorSlug(newName, id);
    }
    vendor.name = newName;
  }
  if (body.description !== undefined) vendor.description = String(body.description).trim();
  if (body.pricing !== undefined) vendor.pricing = String(body.pricing).trim();
  if (body.url !== undefined) vendor.url = String(body.url).trim();
  if (body.isAffiliate !== undefined) vendor.isAffiliate = Boolean(body.isAffiliate);
  if (body.displayOrder !== undefined) vendor.displayOrder = Number(body.displayOrder);
  if (body.isActive !== undefined) vendor.isActive = Boolean(body.isActive);

  await vendor.save();

  return NextResponse.json({
    id: vendor._id.toString(),
    itemId: vendor.itemId.toString(),
    name: vendor.name,
    description: vendor.description,
    pricing: vendor.pricing,
    url: vendor.url,
    vendorSlug: vendor.vendorSlug,
    isAffiliate: vendor.isAffiliate,
    displayOrder: vendor.displayOrder,
    isActive: vendor.isActive,
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminInsights();
  if (auth.error) return auth.error;

  await connectDB();
  const { id } = await params;

  const vendor = await InsightVendor.findByIdAndUpdate(id, { $set: { isActive: false } }, { new: true });
  if (!vendor) {
    return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
