'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { IOperation } from '@/lib/models/Operation';
import { IAsset } from '@/lib/models/Asset';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import OperationForm from '@/components/planning-map/OperationForm';
import { IEmployee } from '@/lib/models/Employee';

export default function OperationsPage() {
  const router = useRouter();
  const [operations, setOperations] = useState<IOperation[]>([]);
  const [assets, setAssets] = useState<IAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOperationForm, setShowOperationForm] = useState(false);
  const [editingOperation, setEditingOperation] = useState<IOperation | undefined>();
  const [uploadingAsset, setUploadingAsset] = useState<string | null>(null);
  const [employees, setEmployees] = useState<IEmployee[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [operationsRes, assetsRes, employeesRes] = await Promise.all([
        fetch('/api/operations?status=active'),
        fetch('/api/assets'),
        fetch('/api/employees'),
      ]);

      if (operationsRes.status === 401 || assetsRes.status === 401 || employeesRes.status === 401) {
        router.push('/login');
        return;
      }

      const operationsData = await operationsRes.json();
      const assetsData = await assetsRes.json();
      const employeesData = await employeesRes.json();


      setOperations(operationsData);
      setAssets(assetsData);
      setEmployees(employeesData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOperation = () => {
    setEditingOperation(undefined);
    setShowOperationForm(true);
  };

  const handleEditOperation = (operation: IOperation) => {
    setEditingOperation(operation);
    setShowOperationForm(true);
  };

  const handleSubmitOperation = async (data: Partial<IOperation>) => {
    try {
      const url = editingOperation ? `/api/operations/${editingOperation._id}` : '/api/operations';
      const method = editingOperation ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        setShowOperationForm(false);
        setEditingOperation(undefined);
        loadData();
      }
    } catch (error) {
      console.error('Error saving operation:', error);
    }
  };

  const handleUploadAsset = (operationId: string) => {
    setUploadingAsset(operationId);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !uploadingAsset) return;

    const uploadPromises = Array.from(files).map(async (file) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', file.name);
      formData.append('linkedOperationId', uploadingAsset);

      try {
        const response = await fetch('/api/assets/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }
        return response.json();
      } catch (error) {
        console.error(`Error uploading ${file.name}:`, error);
        throw error;
      }
    });

    try {
      await Promise.all(uploadPromises);
      setUploadingAsset(null);
      loadData();
    } catch (error) {
      console.error('Error uploading files:', error);
      // Still reload to show successfully uploaded files
      loadData();
    }
  };

  const getOperationAssets = (operationId: string) => {
    return assets.filter((asset) => asset.linkedOperationId?.toString() === operationId);
  };

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return 'Not set';
    return new Date(date).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 px-4 sm:px-6 lg:px-[100px] py-8">
        <div className="max-w-7xl mx-auto">
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 px-4 sm:px-6 lg:px-[100px] py-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Operations</h1>
          <Button onClick={handleCreateOperation} className="w-full sm:w-auto">+ New Operation</Button>
        </div>

        {operations.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-gray-600 dark:text-gray-400 mb-4">No active operations found.</p>
            <Button onClick={handleCreateOperation}>Create Your First Operation</Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {operations.map((operation) => {
              const operationAssets = getOperationAssets(operation._id.toString());
              return (
                <Card key={operation._id.toString()} className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                        {operation.name}
                        <span className="ml-2 text-xs font-normal text-gray-400 dark:text-gray-500">
                          (ID: {operation._id.toString().slice(-6)})
                        </span>
                      </h2>
                      {operation.description && (
                        <p className="text-gray-600 dark:text-gray-400 mb-2">{operation.description}</p>
                      )}
                      {operation.url && (
                        <a
                          href={operation.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {operation.url}
                        </a>
                      )}
                      <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        <span>Recurrence: {operation.recurrenceType}</span>
                        {operation.assignedTo && <span className="ml-4">Assigned to: {operation.assignedTo}</span>}
                        {operation.estimatedHours && <span className="ml-4">{operation.estimatedHours}h</span>}
                        {operation.startDate && (
                          <span className="ml-4">Start: {formatDate(operation.startDate)}</span>
                        )}
                        {operation.endDate && (
                          <span className="ml-4">End: {formatDate(operation.endDate)}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" onClick={() => handleEditOperation(operation)}>
                        Edit
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => handleUploadAsset(operation._id.toString())}>
                        Upload Screenshot
                      </Button>
                    </div>
                  </div>

                  {operationAssets.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Screenshots:</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {operationAssets.map((asset) => (
                          <div key={asset._id.toString()} className="relative">
                            {asset.fileUrl && (
                              <img
                                src={asset.fileUrl}
                                alt={asset.name}
                                className="w-full h-32 object-cover rounded border border-gray-200 dark:border-gray-700"
                              />
                            )}
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 truncate">{asset.name}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* Operation Form Modal */}
        <Modal isOpen={showOperationForm} onClose={() => setShowOperationForm(false)}>
          <OperationForm
            operation={editingOperation}
            onSubmit={handleSubmitOperation}
            onCancel={() => setShowOperationForm(false)}
          />
        </Modal>

        {/* File Upload Modal */}
        <Modal isOpen={uploadingAsset !== null} onClose={() => setUploadingAsset(null)}>
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Upload Screenshots</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Select one or more images to upload
            </p>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileUpload}
              className="block w-full text-sm text-gray-500 dark:text-gray-400
                file:mr-4 file:py-2 file:px-4
                file:rounded-full file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100
                dark:file:bg-blue-900 dark:file:text-blue-300"
            />
            <div className="mt-4 flex justify-end">
              <Button variant="secondary" onClick={() => setUploadingAsset(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
}
