import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import connectDB from '@/lib/db/mongodb';
import InsightItem from '@/lib/models/InsightItem';
import InsightVendor from '@/lib/models/InsightVendor';
import { requireAdminInsights } from '@/lib/insights/requireAdminInsights';
import { generateUniqueVendorSlug } from '@/lib/insights/vendorSlug';

type VendorInput = {
  id?: string;
  name: string;
  description?: string;
  pricing?: string;
  url: string;
  isAffiliate?: boolean;
  displayOrder?: number;
  isActive?: boolean;
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminInsights();
  if (auth.error) return auth.error;

  await connectDB();
  const { id } = await params;
  const body = await request.json();

  const item = await InsightItem.findById(id);
  if (!item) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  }

  if (body.title !== undefined) item.title = String(body.title).trim();
  if (body.description !== undefined) item.description = String(body.description).trim();
  if (body.detectsFromCategorySlug !== undefined) {
    item.detectsFromCategorySlug = body.detectsFromCategorySlug
      ? String(body.detectsFromCategorySlug).trim().toLowerCase()
      : undefined;
  }
  if (body.isActive !== undefined) item.isActive = Boolean(body.isActive);
  if (body.categoryId !== undefined) item.categoryId = new Types.ObjectId(String(body.categoryId));
  if (body.itemOrder !== undefined) item.itemOrder = Number(body.itemOrder);

  await item.save();

  const vendorsInput: VendorInput[] = Array.isArray(body.vendors) ? body.vendors : [];
  const savedVendors = [];
  const keptIds = new Set<string>();

  for (let i = 0; i < vendorsInput.length; i++) {
    const v = vendorsInput[i];
    if (!v.name?.trim() || !v.url?.trim()) continue;

    if (v.id && Types.ObjectId.isValid(v.id)) {
      const existing = await InsightVendor.findById(v.id);
      if (existing && existing.itemId.toString() === id) {
        existing.name = v.name.trim();
        existing.description = v.description?.trim() ?? '';
        existing.pricing = v.pricing?.trim() ?? '';
        existing.url = v.url.trim();
        existing.isAffiliate = Boolean(v.isAffiliate);
        existing.displayOrder = v.displayOrder ?? i;
        existing.isActive = v.isActive !== false;
        if (existing.name !== v.name) {
          existing.vendorSlug = await generateUniqueVendorSlug(v.name, existing._id.toString());
        }
        await existing.save();
        savedVendors.push(existing);
        keptIds.add(existing._id.toString());
        continue;
      }
    }

    const vendorSlug = await generateUniqueVendorSlug(v.name);
    const created = await InsightVendor.create({
      itemId: item._id,
      name: v.name.trim(),
      description: v.description?.trim() ?? '',
      pricing: v.pricing?.trim() ?? '',
      url: v.url.trim(),
      vendorSlug,
      isAffiliate: Boolean(v.isAffiliate),
      displayOrder: v.displayOrder ?? i,
      isActive: v.isActive !== false,
    });
    savedVendors.push(created);
    keptIds.add(created._id.toString());
  }

  if (vendorsInput.length > 0) {
    await InsightVendor.updateMany(
      { itemId: id, _id: { $nin: [...keptIds] } },
      { $set: { isActive: false } }
    );
  }

  return NextResponse.json({
    id: item._id.toString(),
    categoryId: item.categoryId.toString(),
    title: item.title,
    description: item.description,
    itemOrder: item.itemOrder,
    detectsFromCategorySlug: item.detectsFromCategorySlug,
    isActive: item.isActive,
    vendors: savedVendors.map((v) => ({
      id: v._id.toString(),
      itemId: v.itemId.toString(),
      name: v.name,
      description: v.description,
      pricing: v.pricing,
      url: v.url,
      vendorSlug: v.vendorSlug,
      isAffiliate: v.isAffiliate,
      displayOrder: v.displayOrder,
      isActive: v.isActive,
    })),
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

  const item = await InsightItem.findByIdAndUpdate(id, { $set: { isActive: false } }, { new: true });
  if (!item) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
