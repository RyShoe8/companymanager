'use client';

import { IAsset } from '@/lib/models/Asset';
import Card from '@/components/ui/Card';

interface AssetCardProps {
  asset: IAsset;
  onClick?: () => void;
  onDelete?: () => void;
}

export default function AssetCard({ asset, onClick, onDelete }: AssetCardProps) {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete && confirm('Are you sure you want to delete this asset?')) {
      onDelete();
    }
  };

  const typeColors: Record<string, string> = {
    spreadsheet: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    document: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    tool: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    folder: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    link: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
    file: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
    text: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
    screenshot: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    other: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  };

  return (
    <Card className="p-4 mb-3" onClick={onClick}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold text-text-primary text-lg">{asset.name || 'Untitled Asset'}</h3>
            <span className={`text-xs px-2 py-1 rounded ${typeColors[asset.type] || typeColors.other}`}>
              {asset.type}
            </span>
            {asset.category && (
              <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                {asset.category}
              </span>
            )}
          </div>
          {asset.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{asset.description}</p>
          )}
          {asset.url && (
            <a
              href={asset.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 break-all"
            >
              {asset.url}
            </a>
          )}
          {asset.fileUrl && (
            <a
              href={asset.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              download
              onClick={(e) => e.stopPropagation()}
              className="text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download File
            </a>
          )}
          {asset.textContent && (
            <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap line-clamp-3">
                {asset.textContent}
              </p>
              {asset.textContent.length > 150 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {asset.textContent.length} characters
                </p>
              )}
            </div>
          )}
          {asset.tags && asset.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {asset.tags.map((tag, index) => (
                <span
                  key={index}
                  className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
        {onDelete && (
          <button
            onClick={handleDelete}
            className="ml-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
    </Card>
  );
}
