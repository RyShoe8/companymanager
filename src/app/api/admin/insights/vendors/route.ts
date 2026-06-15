import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import InsightVendor from '@/lib/models/InsightVendor';
import { requireAdminInsights } from '@/lib/insights/requireAdminInsights';
import { generateUniqueVendorSlug } from '@/lib/insights/vendorSlug';

export async function POST(request: NextRequest) {
  const auth = await requireAdminInsights();
  if (auth.error) return auth.error;

  await connectDB();
  const body = await request.json();
  const { itemId, name, description, pricing, url, isAffiliate, displayOrder } = body;

  if (!itemId || !name?.trim() || !url?.trim()) {
    return NextResponse.json({ error: 'itemId, name, and url are required' }, { status: 400 });
  }

  const maxOrder = await InsightVendor.findOne({ itemId })
    .sort({ displayOrder: -1 })
    .select('displayOrder')
    .lean();

  const vendorSlug = await generateUniqueVendorSlug(name);
  const vendor = await InsightVendor.create({
    itemId,
    name: name.trim(),
    description: description?.trim() ?? '',
    pricing: pricing?.trim() ?? '',
    url: url.trim(),
    vendorSlug,
    isAffiliate: Boolean(isAffiliate),
    displayOrder: displayOrder ?? (maxOrder?.displayOrder ?? 0) + 1,
    isActive: true,
  });

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

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminInsights();
  if (auth.error) return auth.error;

  await connectDB();
  const body = await request.json();
  const order: { id: string; displayOrder: number }[] = body.order ?? [];

  if (!Array.isArray(order)) {
    return NextResponse.json({ error: 'order array required' }, { status: 400 });
  }

  await Promise.all(
    order.map(({ id, displayOrder }) =>
      InsightVendor.updateOne({ _id: id }, { $set: { displayOrder } })
    )
  );

  return NextResponse.json({ ok: true });
}
