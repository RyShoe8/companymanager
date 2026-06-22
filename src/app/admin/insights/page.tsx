'use client';

import { useCallback, useEffect, useState } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { getCategoryBadgeClass } from '@/lib/insights/categoryColors';

interface VendorRow {
  id?: string;
  name: string;
  description: string;
  pricing: string;
  url: string;
  isAffiliate: boolean;
  displayOrder: number;
  isActive: boolean;
}

interface ItemRow {
  id: string;
  categoryId: string;
  title: string;
  description: string;
  itemOrder: number;
  detectsFromCategorySlug?: string;
  isActive: boolean;
  vendorCount: number;
  hiddenVendorCount?: number;
  vendors: VendorRow[];
}

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  stageOrder: number;
  icon: string;
  mapsToPlatformCategory?: string;
  items: ItemRow[];
}

const emptyVendor = (): VendorRow => ({
  name: '',
  description: '',
  pricing: '',
  url: '',
  isAffiliate: false,
  displayOrder: 0,
  isActive: true,
});

function formatVendorSummary(item: ItemRow): string {
  const hidden =
    item.hiddenVendorCount ??
    item.vendors.filter((v) => !v.isActive).length;
  const active = item.vendorCount;
  const vendorLabel = `${active} vendor${active === 1 ? '' : 's'}`;
  if (hidden > 0) {
    return `${vendorLabel} · ${hidden} hidden`;
  }
  return vendorLabel;
}

export default function AdminInsightsPage() {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [platformSlugs, setPlatformSlugs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<ItemRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [showNewItem, setShowNewItem] = useState(false);
  const [newItemCategoryId, setNewItemCategoryId] = useState('');
  const [newItemTitle, setNewItemTitle] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/insights/categories');
      if (res.status === 403) {
        setError('Access denied. Platform admin required.');
        return;
      }
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setCategories(data.categories ?? []);
      setPlatformSlugs(data.platformCategorySlugs ?? []);
      if (!newItemCategoryId && data.categories?.[0]?.id) {
        setNewItemCategoryId(data.categories[0].id);
      }
    } catch {
      setError('Failed to load insights');
    } finally {
      setLoading(false);
    }
  }, [newItemCategoryId]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleCategory = (id: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openItem = (item: ItemRow) => {
    setExpandedItemId(item.id);
    setDraft({
      ...item,
      vendors: item.vendors.length ? item.vendors.map((v) => ({ ...v })) : [emptyVendor()],
    });
  };

  const saveItem = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/insights/items/${draft.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: draft.title,
          description: draft.description,
          detectsFromCategorySlug: draft.detectsFromCategorySlug || null,
          isActive: draft.isActive,
          vendors: draft.vendors.filter((v) => v.name.trim() && v.url.trim()),
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      setExpandedItemId(null);
      setDraft(null);
      await load();
    } catch {
      alert('Failed to save item');
    } finally {
      setSaving(false);
    }
  };

  const createItem = async () => {
    if (!newItemTitle.trim() || !newItemCategoryId) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/insights/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId: newItemCategoryId,
          title: newItemTitle.trim(),
        }),
      });
      if (!res.ok) throw new Error('Create failed');
      setShowNewItem(false);
      setNewItemTitle('');
      await load();
    } catch {
      alert('Failed to create item');
    } finally {
      setSaving(false);
    }
  };

  const moveItem = async (categoryId: string, items: ItemRow[], index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const reordered = [...items];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    const order = reordered.map((item, i) => ({ id: item.id, itemOrder: i, categoryId }));
    await fetch('/api/admin/insights/items/reorder', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order }),
    });
    await load();
  };

  const moveCategory = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= categories.length) return;
    const reordered = [...categories];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    const order = reordered.map((cat, i) => ({ id: cat.id, stageOrder: i + 1 }));
    await fetch('/api/admin/insights/categories/reorder', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order }),
    });
    await load();
  };

  const deactivateItem = async (id: string) => {
    if (!confirm('Hide this insight item from all projects?')) return;
    await fetch(`/api/admin/insights/items/${id}`, { method: 'DELETE' });
    setExpandedItemId(null);
    setDraft(null);
    await load();
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <p className="text-text-secondary">Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Insights</h1>
          <p className="text-sm text-text-secondary mt-1">
            Manage journey insight items and vendor recommendations (platform admin).
          </p>
        </div>
        <Button onClick={() => setShowNewItem(true)}>New insight item</Button>
      </div>

      {showNewItem && (
        <Card className="p-4 space-y-3">
          <h2 className="font-semibold text-text-primary">New insight item</h2>
          <div>
            <label className="block text-xs text-text-secondary mb-1">Category</label>
            <select
              value={newItemCategoryId}
              onChange={(e) => setNewItemCategoryId(e.target.value)}
              className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
          <Input value={newItemTitle} onChange={(e) => setNewItemTitle(e.target.value)} placeholder="Title" />
          <div className="flex gap-2">
            <Button onClick={() => void createItem()} disabled={saving || !newItemTitle.trim()}>
              Create
            </Button>
            <Button variant="secondary" onClick={() => setShowNewItem(false)}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {categories.map((cat, catIndex) => (
        <Card key={cat.id} className="overflow-hidden">
          <div className="flex items-center gap-2 p-4 border-b border-border">
            <button type="button" onClick={() => toggleCategory(cat.id)} className="text-text-secondary hover:text-text-primary">
              {collapsedCategories.has(cat.id) ? '▶' : '▼'}
            </button>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getCategoryBadgeClass(cat.slug)}`}>
              {cat.name}
            </span>
            <span className="text-xs text-text-secondary">Stage {cat.stageOrder}</span>
            <span className="text-xs text-text-muted ml-auto">{cat.items.length} items</span>
            <button type="button" className="text-xs text-text-secondary px-1" onClick={() => void moveCategory(catIndex, -1)} disabled={catIndex === 0}>
              ↑
            </button>
            <button
              type="button"
              className="text-xs text-text-secondary px-1"
              onClick={() => void moveCategory(catIndex, 1)}
              disabled={catIndex === categories.length - 1}
            >
              ↓
            </button>
          </div>

          {!collapsedCategories.has(cat.id) && (
            <div className="divide-y divide-border">
              {cat.items.length === 0 ? (
                <p className="p-4 text-sm text-text-secondary">No items in this category.</p>
              ) : (
                cat.items.map((item, itemIndex) => (
                  <div key={item.id}>
                    <div className="flex items-center gap-2 p-4 hover:bg-background-elevated/50">
                      <button type="button" className="flex-1 text-left min-w-0" onClick={() => openItem(item)}>
                        <p className="font-medium text-text-primary truncate">{item.title}</p>
                        <p className="text-xs text-text-secondary">
                          {formatVendorSummary(item)} · order {item.itemOrder}
                          {!item.isActive && ' · hidden'}
                        </p>
                      </button>
                      <button type="button" className="text-xs text-text-secondary" onClick={() => void moveItem(cat.id, cat.items, itemIndex, -1)} disabled={itemIndex === 0}>
                        ↑
                      </button>
                      <button
                        type="button"
                        className="text-xs text-text-secondary"
                        onClick={() => void moveItem(cat.id, cat.items, itemIndex, 1)}
                        disabled={itemIndex === cat.items.length - 1}
                      >
                        ↓
                      </button>
                    </div>

                    {expandedItemId === item.id && draft && (
                      <div className="px-4 pb-4 space-y-3 bg-background-elevated/30">
                        <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Title" />
                        <textarea
                          value={draft.description}
                          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                          placeholder="Description"
                          rows={3}
                          className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
                        />
                        <label className="flex items-center gap-2 text-sm text-text-secondary">
                          <input
                            type="checkbox"
                            checked={draft.isActive}
                            onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
                          />
                          Active
                        </label>
                        <div>
                          <label className="block text-xs text-text-secondary mb-1">Auto-detect from platform category</label>
                          <select
                            value={draft.detectsFromCategorySlug ?? ''}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                detectsFromCategorySlug: e.target.value || undefined,
                              })
                            }
                            className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
                          >
                            <option value="">— none —</option>
                            {platformSlugs.map((slug) => (
                              <option key={slug} value={slug}>
                                {slug}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-text-primary">Vendors</h3>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() =>
                                setDraft({
                                  ...draft,
                                  vendors: [...draft.vendors, { ...emptyVendor(), displayOrder: draft.vendors.length }],
                                })
                              }
                            >
                              Add vendor
                            </Button>
                          </div>
                          {draft.vendors.map((vendor, vi) => (
                            <div
                              key={vendor.id ?? `new-${vi}`}
                              className={`grid gap-2 p-3 rounded border border-border ${
                                vendor.isActive ? '' : 'opacity-60 bg-background-elevated/50'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-medium text-text-secondary">
                                  Vendor {vi + 1}
                                </span>
                                {!vendor.isActive && (
                                  <span className="text-xs text-text-muted border border-border rounded px-1.5 py-0.5">
                                    Hidden
                                  </span>
                                )}
                              </div>
                              <Input value={vendor.name} onChange={(e) => {
                                const vendors = [...draft.vendors];
                                vendors[vi] = { ...vendor, name: e.target.value };
                                setDraft({ ...draft, vendors });
                              }} placeholder="Name" />
                              <Input value={vendor.description} onChange={(e) => {
                                const vendors = [...draft.vendors];
                                vendors[vi] = { ...vendor, description: e.target.value };
                                setDraft({ ...draft, vendors });
                              }} placeholder="Description" />
                              <Input value={vendor.pricing} onChange={(e) => {
                                const vendors = [...draft.vendors];
                                vendors[vi] = { ...vendor, pricing: e.target.value };
                                setDraft({ ...draft, vendors });
                              }} placeholder="Pricing" />
                              <Input value={vendor.url} onChange={(e) => {
                                const vendors = [...draft.vendors];
                                vendors[vi] = { ...vendor, url: e.target.value };
                                setDraft({ ...draft, vendors });
                              }} placeholder="URL" />
                              <label className="flex items-center gap-2 text-xs text-text-secondary">
                                <input
                                  type="checkbox"
                                  checked={vendor.isAffiliate}
                                  onChange={(e) => {
                                    const vendors = [...draft.vendors];
                                    vendors[vi] = { ...vendor, isAffiliate: e.target.checked };
                                    setDraft({ ...draft, vendors });
                                  }}
                                />
                                Affiliate link
                              </label>
                              <label className="flex items-center gap-2 text-xs text-text-secondary">
                                <input
                                  type="checkbox"
                                  checked={vendor.isActive}
                                  onChange={(e) => {
                                    const vendors = [...draft.vendors];
                                    vendors[vi] = { ...vendor, isActive: e.target.checked };
                                    setDraft({ ...draft, vendors });
                                  }}
                                />
                                Show on frontend
                              </label>
                              <button
                                type="button"
                                className="text-xs text-red-500 text-left"
                                onClick={() => {
                                  const vendors = draft.vendors.filter((_, i) => i !== vi);
                                  setDraft({ ...draft, vendors: vendors.length ? vendors : [emptyVendor()] });
                                }}
                              >
                                Remove vendor
                              </button>
                            </div>
                          ))}
                        </div>

                        <div className="flex flex-wrap gap-2 pt-2">
                          <Button onClick={() => void saveItem()} disabled={saving}>
                            Save
                          </Button>
                          <Button variant="secondary" onClick={() => { setExpandedItemId(null); setDraft(null); }}>
                            Cancel
                          </Button>
                          <Button variant="secondary" onClick={() => void deactivateItem(draft.id)}>
                            Hide item
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
