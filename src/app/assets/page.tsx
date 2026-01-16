'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { IAsset } from '@/lib/models/Asset';
import AssetCard from '@/components/assets/AssetCard';
import AssetSearch from '@/components/assets/AssetSearch';
import AssetForm from '@/components/assets/AssetForm';
import AssetFilters from '@/components/assets/AssetFilters';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';

function AssetsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [assets, setAssets] = useState<IAsset[]>([]);
  const [filteredAssets, setFilteredAssets] = useState<IAsset[]>([]);
  const [projects, setProjects] = useState<Array<{ _id: string; name: string }>>([]);
  const [operations, setOperations] = useState<Array<{ _id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState<string | null>(null);
  const [operationFilter, setOperationFilter] = useState<string | null>(null);
  const [showAssetForm, setShowAssetForm] = useState(false);
  const [editingAsset, setEditingAsset] = useState<IAsset | undefined>();

  useEffect(() => {
    // Get filter parameters from URL
    const projectId = searchParams?.get('projectId');
    const operationId = searchParams?.get('operationId');
    if (projectId) {
      setProjectFilter(projectId);
    }
    if (operationId) {
      setOperationFilter(operationId);
    }
    loadData();
  }, [searchParams]);

  useEffect(() => {
    filterAssets();
  }, [assets, searchQuery, typeFilter, categoryFilter, projectFilter, operationFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [assetsRes, projectsRes, operationsRes] = await Promise.all([
        fetch('/api/assets'),
        fetch('/api/projects'),
        fetch('/api/operations'),
      ]);

      if (assetsRes.status === 401 || projectsRes.status === 401 || operationsRes.status === 401) {
        router.push('/login');
        return;
      }

      const assetsData = await assetsRes.json();
      const projectsData = await projectsRes.json();
      const operationsData = await operationsRes.json();

      setAssets(assetsData);
      setProjects(projectsData);
      setOperations(operationsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterAssets = async () => {
    let filtered = [...assets];

    // Apply project filter
    if (projectFilter) {
      filtered = filtered.filter((asset) => {
        const linkedProjectId = asset.linkedProjectId?.toString();
        return linkedProjectId === projectFilter;
      });
    }

    // Apply operation filter
    if (operationFilter) {
      filtered = filtered.filter((asset) => {
        const linkedOperationId = asset.linkedOperationId?.toString();
        return linkedOperationId === operationFilter;
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
      console.error('Error deleting asset:', error);
    }
  };

  const handleSubmitAsset = async (data: Omit<Partial<IAsset>, 'linkedProjectId' | 'linkedOperationId'> & { linkedProjectId?: string; linkedOperationId?: string }) => {
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
      console.error('Error saving asset:', error);
    }
  };

  const categories = Array.from(new Set(assets.map((a) => a.category).filter(Boolean))) as string[];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-300">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="w-full mx-auto px-[100px] max-md:px-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-4">Assets</h1>
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <AssetSearch value={searchQuery} onChange={setSearchQuery} />
            </div>
            <Button onClick={handleCreateAsset}>+ New Asset</Button>
          </div>
          <AssetFilters
            type={typeFilter}
            category={categoryFilter}
            onTypeChange={setTypeFilter}
            onCategoryChange={setCategoryFilter}
            onClear={() => {
              setTypeFilter('');
              setCategoryFilter('');
              setProjectFilter(null);
              setOperationFilter(null);
              router.push('/assets');
            }}
            categories={categories}
          />
        </div>

        {filteredAssets.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <p className="text-gray-300">
              {searchQuery || typeFilter || categoryFilter
                ? 'No assets match your filters'
                : 'No assets yet. Create your first asset!'}
            </p>
          </div>
        ) : (
          <div>
            {filteredAssets.map((asset) => (
              <AssetCard
                key={asset._id.toString()}
                asset={asset}
                onClick={() => handleEditAsset(asset)}
                onDelete={() => handleDeleteAsset(asset._id.toString())}
              />
            ))}
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
            operations={operations}
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
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center text-gray-300">Loading...</div>
      </div>
    }>
      <AssetsPageContent />
    </Suspense>
  );
}
