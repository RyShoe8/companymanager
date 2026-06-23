'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

type StackTab = 'tech' | 'marketing';

interface OptionRow {
  id: string;
  optionId: string;
  categorySlug: string;
  name: string;
  homepageUrl: string;
  simpleIconSlug?: string;
  iconExtension: 'svg' | 'png';
  iconUrl?: string;
  displayOrder: number;
  isActive: boolean;
}

interface CategoryRow {
  id: string;
  stackType: StackTab;
  slug: string;
  label: string;
  displayOrder: number;
  isActive: boolean;
  options: OptionRow[];
}

interface CatalogData {
  tech: { categories: CategoryRow[] };
  marketing: { categories: CategoryRow[] };
}

const emptyOptionDraft = (): Partial<OptionRow> => ({
  optionId: '',
  name: '',
  homepageUrl: '',
  simpleIconSlug: '',
  iconExtension: 'svg',
  isActive: true,
});

export default function AdminPlatformCatalogPage() {
  const [tab, setTab] = useState<StackTab>('tech');
  const [data, setData] = useState<CatalogData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null);
  const [optionDraft, setOptionDraft] = useState<Partial<OptionRow>>(emptyOptionDraft());
  const [newCategoryLabel, setNewCategoryLabel] = useState('');
  const [newCategorySlug, setNewCategorySlug] = useState('');
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [uploadTargetOptionId, setUploadTargetOptionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/platform-catalog');
      if (res.status === 403) {
        setError('Access denied. Platform admin required.');
        return;
      }
      if (!res.ok) throw new Error('Failed to load');
      const json = await res.json();
      setData({ tech: json.tech, marketing: json.marketing });
    } catch {
      setError('Failed to load platform catalog');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const categories = tab === 'tech' ? data?.tech.categories ?? [] : data?.marketing.categories ?? [];

  const saveCategory = async (category: CategoryRow, updates: Partial<CategoryRow>) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/platform-catalog/categories/${category.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save category');
      }
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to save category');
    } finally {
      setSaving(false);
    }
  };

  const addCategory = async () => {
    if (!newCategoryLabel.trim() || !newCategorySlug.trim()) {
      alert('Label and slug are required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/platform-catalog/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stackType: tab,
          label: newCategoryLabel.trim(),
          slug: newCategorySlug.trim().toLowerCase(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to add category');
      }
      setNewCategoryLabel('');
      setNewCategorySlug('');
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to add category');
    } finally {
      setSaving(false);
    }
  };

  const moveCategory = async (category: CategoryRow, direction: -1 | 1) => {
    const idx = categories.findIndex((c) => c.id === category.id);
    const swapIdx = idx + direction;
    if (idx < 0 || swapIdx < 0 || swapIdx >= categories.length) return;
    const reordered = [...categories];
    const [item] = reordered.splice(idx, 1);
    reordered.splice(swapIdx, 0, item);
    const order = reordered.map((c, i) => ({ id: c.id, displayOrder: i }));
    setSaving(true);
    try {
      const res = await fetch('/api/admin/platform-catalog/categories/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order }),
      });
      if (!res.ok) throw new Error('Failed to reorder');
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to reorder');
    } finally {
      setSaving(false);
    }
  };

  const startNewOption = (category: CategoryRow) => {
    setExpandedCategoryId(category.id);
    setEditingOptionId('new');
    setOptionDraft({ ...emptyOptionDraft(), categorySlug: category.slug });
  };

  const startEditOption = (option: OptionRow) => {
    setEditingOptionId(option.id);
    setOptionDraft({ ...option });
  };

  const saveOption = async () => {
    if (!optionDraft.name?.trim() || !optionDraft.homepageUrl?.trim()) {
      alert('Name and homepage URL are required');
      return;
    }
    setSaving(true);
    try {
      if (editingOptionId === 'new') {
        if (!optionDraft.optionId?.trim()) {
          alert('Option ID is required');
          return;
        }
        const res = await fetch('/api/admin/platform-catalog/options', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stackType: tab,
            categorySlug: optionDraft.categorySlug,
            optionId: optionDraft.optionId.trim(),
            name: optionDraft.name.trim(),
            homepageUrl: optionDraft.homepageUrl.trim(),
            simpleIconSlug: optionDraft.simpleIconSlug?.trim() || optionDraft.optionId.trim(),
            iconExtension: optionDraft.iconExtension ?? 'svg',
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to create option');
        }
      } else if (editingOptionId) {
        const res = await fetch(`/api/admin/platform-catalog/options/${editingOptionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: optionDraft.name.trim(),
            homepageUrl: optionDraft.homepageUrl.trim(),
            simpleIconSlug: optionDraft.simpleIconSlug?.trim(),
            iconExtension: optionDraft.iconExtension ?? 'svg',
            isActive: optionDraft.isActive !== false,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to update option');
        }
      }
      setEditingOptionId(null);
      setOptionDraft(emptyOptionDraft());
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to save option');
    } finally {
      setSaving(false);
    }
  };

  const fetchIcon = async (optionId: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/platform-catalog/options/${optionId}/fetch-icon`, {
        method: 'POST',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to fetch icon');
      }
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to fetch icon');
    } finally {
      setSaving(false);
    }
  };

  const triggerUpload = (optionId: string) => {
    setUploadTargetOptionId(optionId);
    uploadInputRef.current?.click();
  };

  const handleUpload = async (file: File) => {
    if (!uploadTargetOptionId) return;
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(
        `/api/admin/platform-catalog/options/${uploadTargetOptionId}/upload-icon`,
        { method: 'POST', body: formData }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to upload icon');
      }
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to upload icon');
    } finally {
      setSaving(false);
      setUploadTargetOptionId(null);
    }
  };

  const hideOption = async (option: OptionRow) => {
    if (!confirm(`Hide "${option.name}" from the linking picker?`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/platform-catalog/options/${option.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to hide option');
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to hide option');
    } finally {
      setSaving(false);
    }
  };

  const optionIconPreview = (option: OptionRow) => {
    if (option.iconUrl) return option.iconUrl;
    const ext = option.iconExtension ?? 'svg';
    const folder = tab === 'tech' ? 'tech-stack' : 'marketing-stack';
    return `/icons/${folder}/${option.optionId}.${ext}`;
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-[100px] py-8">
        <p className="text-text-secondary">Loading platform catalog…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-[100px] py-8">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-[100px] py-8">
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/svg+xml,image/png,image/webp,image/jpeg"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleUpload(file);
          e.target.value = '';
        }}
      />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Platform catalog</h1>
          <p className="text-sm text-text-secondary mt-1">
            Manage categories and linkable platforms for tech and marketing stacks.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void load()} disabled={saving}>
          Refresh
        </Button>
      </div>

      <div className="flex gap-2 mb-6">
        {(['tech', 'marketing'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTab(t);
              setExpandedCategoryId(null);
              setEditingOptionId(null);
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium border ${
              tab === t
                ? 'bg-primary text-white border-primary'
                : 'bg-background-card border-border text-text-secondary hover:text-text-primary'
            }`}
          >
            {t === 'tech' ? 'Tech stack' : 'Marketing & analytics'}
          </button>
        ))}
      </div>

      <Card className="p-4 mb-6">
        <h2 className="text-sm font-semibold mb-3">Add category</h2>
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[10rem]">
            <label className="text-xs text-text-secondary">Label</label>
            <Input
              value={newCategoryLabel}
              onChange={(e) => {
                setNewCategoryLabel(e.target.value);
                if (!newCategorySlug) {
                  setNewCategorySlug(
                    e.target.value.trim().toLowerCase().replace(/\s+/g, '-')
                  );
                }
              }}
              placeholder="e.g. Hosting"
            />
          </div>
          <div className="flex-1 min-w-[10rem]">
            <label className="text-xs text-text-secondary">Slug</label>
            <Input
              value={newCategorySlug}
              onChange={(e) => setNewCategorySlug(e.target.value)}
              placeholder="e.g. hosting"
            />
          </div>
          <Button onClick={() => void addCategory()} disabled={saving}>
            Add category
          </Button>
        </div>
      </Card>

      <div className="space-y-4">
        {categories.map((category, idx) => (
          <Card key={category.id} className="p-4">
            <div className="flex flex-wrap items-center gap-2 justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  className="text-sm font-semibold text-text-primary hover:underline"
                  onClick={() =>
                    setExpandedCategoryId((prev) => (prev === category.id ? null : category.id))
                  }
                >
                  {category.label}
                </button>
                <span className="text-xs text-text-secondary font-mono">{category.slug}</span>
                {!category.isActive && (
                  <span className="text-xs text-amber-600">Hidden</span>
                )}
                <span className="text-xs text-text-secondary">
                  {category.options.length} option{category.options.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={saving || idx === 0}
                  onClick={() => void moveCategory(category, -1)}
                >
                  ↑
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={saving || idx === categories.length - 1}
                  onClick={() => void moveCategory(category, 1)}
                >
                  ↓
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={saving}
                  onClick={() =>
                    void saveCategory(category, { isActive: !category.isActive })
                  }
                >
                  {category.isActive ? 'Hide' : 'Show'}
                </Button>
                <Button size="sm" disabled={saving} onClick={() => startNewOption(category)}>
                  Add option
                </Button>
              </div>
            </div>

            {expandedCategoryId === category.id && (
              <div className="mt-4 space-y-3 border-t border-border pt-4">
                {category.options.map((option) => (
                  <div
                    key={option.id}
                    className={`flex flex-wrap items-center gap-3 p-2 rounded-lg ${
                      !option.isActive ? 'opacity-50' : ''
                    } ${editingOptionId === option.id ? 'bg-background' : ''}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={optionIconPreview(option)}
                      alt=""
                      width={24}
                      height={24}
                      className="shrink-0"
                    />
                    <div className="flex-1 min-w-[12rem]">
                      <div className="text-sm font-medium">{option.name}</div>
                      <div className="text-xs text-text-secondary font-mono">{option.optionId}</div>
                    </div>
                    {editingOptionId === option.id ? (
                      <div className="w-full grid gap-2 sm:grid-cols-2 mt-2">
                        <Input
                          label="Name"
                          value={optionDraft.name ?? ''}
                          onChange={(e) => setOptionDraft((d) => ({ ...d, name: e.target.value }))}
                        />
                        <Input
                          label="Homepage URL"
                          value={optionDraft.homepageUrl ?? ''}
                          onChange={(e) =>
                            setOptionDraft((d) => ({ ...d, homepageUrl: e.target.value }))
                          }
                        />
                        <Input
                          label="Simple Icons slug"
                          value={optionDraft.simpleIconSlug ?? ''}
                          onChange={(e) =>
                            setOptionDraft((d) => ({ ...d, simpleIconSlug: e.target.value }))
                          }
                        />
                        <label className="flex items-center gap-2 text-sm mt-6">
                          <input
                            type="checkbox"
                            checked={optionDraft.isActive !== false}
                            onChange={(e) =>
                              setOptionDraft((d) => ({ ...d, isActive: e.target.checked }))
                            }
                          />
                          Active in picker
                        </label>
                        <div className="sm:col-span-2 flex gap-2">
                          <Button size="sm" onClick={() => void saveOption()} disabled={saving}>
                            Save
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setEditingOptionId(null);
                              setOptionDraft(emptyOptionDraft());
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => startEditOption(option)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={saving}
                          onClick={() => void fetchIcon(option.id)}
                        >
                          Fetch icon
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={saving}
                          onClick={() => triggerUpload(option.id)}
                        >
                          Upload icon
                        </Button>
                        {option.isActive && (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={saving}
                            onClick={() => void hideOption(option)}
                          >
                            Hide
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {editingOptionId === 'new' && optionDraft.categorySlug === category.slug && (
                  <Card className="p-3 bg-background">
                    <h3 className="text-sm font-medium mb-2">New option</h3>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Input
                        label="Option ID (slug)"
                        value={optionDraft.optionId ?? ''}
                        onChange={(e) =>
                          setOptionDraft((d) => ({
                            ...d,
                            optionId: e.target.value,
                            simpleIconSlug: d.simpleIconSlug || e.target.value,
                          }))
                        }
                      />
                      <Input
                        label="Name"
                        value={optionDraft.name ?? ''}
                        onChange={(e) => setOptionDraft((d) => ({ ...d, name: e.target.value }))}
                      />
                      <Input
                        label="Homepage URL"
                        value={optionDraft.homepageUrl ?? ''}
                        onChange={(e) =>
                          setOptionDraft((d) => ({ ...d, homepageUrl: e.target.value }))
                        }
                      />
                      <Input
                        label="Simple Icons slug"
                        value={optionDraft.simpleIconSlug ?? ''}
                        onChange={(e) =>
                          setOptionDraft((d) => ({ ...d, simpleIconSlug: e.target.value }))
                        }
                      />
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" onClick={() => void saveOption()} disabled={saving}>
                        Create
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setEditingOptionId(null);
                          setOptionDraft(emptyOptionDraft());
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </Card>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
