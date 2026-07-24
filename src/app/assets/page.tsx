'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { IAsset } from '@/lib/models/Asset';
import AssetCard from '@/components/assets/AssetCard';
import AssetSearch from '@/components/assets/AssetSearch';
import AssetForm, { type AssetFormSubmitData } from '@/components/assets/AssetForm';
import AssetFilters from '@/components/assets/AssetFilters';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { PAGE_GUTTER_WIDE_CLASS } from '@/lib/ui/mobileLayout';

function AssetsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [assets, setAssets] = useState<IAsset[]>([]);
  const [filteredAssets, setFilteredAssets] = useState<IAsset[]>([]);
  const [projects, setProjects] = useState<Array<{ _id: string; name: string }>>([]);
  const [clients, setClients] = useState<Array<{ _id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState<string | null>(null);
  const [clientFilter, setClientFilter] = useState<string | null>(null);
  const [taskIndexFilter, setTaskIndexFilter] = useState<number | null>(null);
  const [taskIdFilter, setTaskIdFilter] = useState<string | null>(null);
  const [showAssetForm, setShowAssetForm] = useState(false);
  const [editingAsset, setEditingAsset] = useState<IAsset | undefined>();

  useEffect(() => {
    // Get filter parameters from URL
    const projectId = searchParams?.get('projectId');
    const clientId = searchParams?.get('clientId');
    const linkedClientId = searchParams?.get('linkedClientId');
    const taskIndex = searchParams?.get('taskIndex');
    const taskId = searchParams?.get('taskId');
    if (clientId || linkedClientId) {
      setClientFilter(clientId || linkedClientId);
    }
    if (projectId) {
      setProjectFilter(projectId);
    }
    if (taskId) {
      setTaskIdFilter(taskId);
      setTaskIndexFilter(null);
    } else if (taskIndex) {
      setTaskIndexFilter(parseInt(taskIndex));
      setTaskIdFilter(null);
    } else {
      setTaskIndexFilter(null);
      setTaskIdFilter(null);
    }
    loadData();
  }, [searchParams]);

  useEffect(() => {
    filterAssets();
  }, [assets, searchQuery, typeFilter, categoryFilter, projectFilter, clientFilter, taskIndexFilter, taskIdFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [assetsRes, projectsRes, clientsRes] = await Promise.all([
        fetch('/api/assets'),
        fetch('/api/projects'),
        fetch('/api/clients'),
      ]);

      if (assetsRes.status === 401 || projectsRes.status === 401 || clientsRes.status === 401) {
        router.push('/login');
        return;
      }

      const assetsData = await assetsRes.json();
      const projectsData = await projectsRes.json();
      const clientsData = await clientsRes.json();

      setAssets(assetsData);
      setProjects(projectsData);
      setClients(clientsData);
    } catch (error) {
      // Error loading data
    } finally {
      setLoading(false);
    }
  };

  const filterAssets = async () => {
    let filtered = [...assets];

    if (clientFilter) {
      filtered = filtered.filter((asset) => asset.linkedClientId?.toString() === clientFilter);
    }

    // Apply project filter
    if (projectFilter) {
      filtered = filtered.filter((asset) => {
        const linkedProjectId = asset.linkedProjectId?.toString();
        if (linkedProjectId !== projectFilter) return false;

        // If taskIdFilter is set, filter by stable task ID
        if (taskIdFilter) {
          return asset.linkedProjectTaskId?.toString() === taskIdFilter;
        }
        // If taskIndexFilter is set (legacy), filter by task index
        if (taskIndexFilter !== null) {
          return asset.linkedProjectTaskIndex === taskIndexFilter;
        }

        return true;
      });
    }


    // Apply search
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (asset) =>
          asset.name.toLowerCase().includes(searchLower) ||
          asset.description?.toLowerCase().includes(searchLower) ||
          asset.tags?.some((tag) => tag.toLowerCase().includes(searchLower))
      );
    }

    // Apply type filter
    if (typeFilter) {
      filtered = filtered.filter((asset) => asset.type === typeFilter);
    }

    // Apply category filter
    if (categoryFilter) {
      filtered = filtered.filter((asset) => asset.category === categoryFilter);
    }

    setFilteredAssets(filtered);
  };

  const handleCreateAsset = () => {
    setEditingAsset(undefined);
    setShowAssetForm(true);
  };

  const handleEditAsset = (asset: IAsset) => {
    setEditingAsset(asset);
    setShowAssetForm(true);
  };

  const handleDeleteAsset = async (id: string) => {
    try {
      const response = await fetch(`/api/assets/${id}`, { method: 'DELETE' });
      if (response.ok) {
        loadData();
      }
    } catch (error) {
      // Error deleting asset
    }
  };

  const handleSubmitAsset = async (data: AssetFormSubmitData) => {
    try {
      const url = editingAsset ? `/api/assets/${editingAsset._id}` : '/api/assets';
      const method = editingAsset ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        setShowAssetForm(false);
        setEditingAsset(undefined);
        loadData();
      }
    } catch (error) {
      // Error saving asset
    }
  };

  const categories = Array.from(new Set(assets.map((a) => a.category).filter(Boolean))) as string[];

  const clientNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const client of clients) {
      map.set(client._id, client.name);
    }
    return map;
  }, [clients]);

  const projectNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const project of projects) {
      map.set(project._id, project.name);
    }
    return map;
  }, [projects]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-text-secondary">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className={`w-full mx-auto ${PAGE_GUTTER_WIDE_CLASS}`}>
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-text-primary mb-4">Assets</h1>
          <div className="flex gap-4 mb-4" data-tour="assets-upload">
            <div className="flex-1">
              <AssetSearch value={searchQuery} onChange={setSearchQuery} />
            </div>
            <Button onClick={handleCreateAsset}>+ New Asset</Button>
          </div>
          <div data-tour="assets-filters">
          <AssetFilters
            type={typeFilter}
            category={categoryFilter}
            onTypeChange={setTypeFilter}
            onCategoryChange={setCategoryFilter}
            onClear={() => {
              setTypeFilter('');
              setCategoryFilter('');
              setProjectFilter(null);
              setClientFilter(null);
              setTaskIndexFilter(null);
              setTaskIdFilter(null);
              router.push('/assets');
            }}
            categories={categories}
          />
          </div>
        </div>

        {filteredAssets.length === 0 ? (
          <div className="text-center py-12 bg-background-card rounded-lg border border-border" data-tour="assets-grid">
            <p className="text-text-secondary">
              {searchQuery || typeFilter || categoryFilter
                ? 'No assets match your filters'
                : 'No assets yet. Create your first asset!'}
            </p>
          </div>
        ) : (
          <div data-tour="assets-grid">
            {filteredAssets.map((asset) => {
              const linkedProjectId = asset.linkedProjectId?.toString();
              return (
              <AssetCard
                key={asset._id.toString()}
                asset={asset}
                linkedProjectId={linkedProjectId}
                linkedProjectName={
                  linkedProjectId ? projectNameById.get(linkedProjectId) : undefined
                }
                onClick={() => handleEditAsset(asset)}
                onDelete={() => handleDeleteAsset(asset._id.toString())}
              />
            );
            })}
          </div>
        )}

        <Modal
          isOpen={showAssetForm}
          onClose={() => {
            setShowAssetForm(false);
            setEditingAsset(undefined);
          }}
          title={editingAsset ? 'Edit Asset' : 'New Asset'}
        >
          <AssetForm
            asset={editingAsset}
            projects={projects}
            clients={clients}
            linkedClientId={clientFilter ?? undefined}
            linkedProjectId={projectFilter ?? undefined}
            onSubmit={handleSubmitAsset}
            onCancel={() => {
              setShowAssetForm(false);
              setEditingAsset(undefined);
            }}
          />
        </Modal>
      </div>
    </div>
  );
}

export default function AssetsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center text-text-secondary">Loading...</div>
      </div>
    }>
      <AssetsPageContent />
    </Suspense>
  );
}
