'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface PortalData {
  name: string;
  logo?: string;
  color: string;
  urls: string[];
  assets: Array<{
    _id: string;
    name: string;
    type: string;
    url?: string;
    fileUrl?: string;
    textContent?: string;
  }>;
  contentCalendar: Array<{
    _id: string;
    title: string;
    channel: string;
    status: string;
    publishDate?: string;
  }>;
}

export default function ClientPortalPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const token = searchParams.get('token');
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    const url = token ? `/api/portal/${slug}?token=${encodeURIComponent(token)}` : `/api/portal/${slug}`;
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 404 ? 'Portal not found' : res.status === 403 ? 'Invalid or missing link' : 'Failed to load');
        return res.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug, token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Portal not found'}</p>
          <Link href="/" className="text-primary hover:underline">Go to Nucleas</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <header className="mb-8">
          {data.logo ? (
            <img src={data.logo} alt={data.name} className="h-14 w-auto mb-4 object-contain" />
          ) : (
            <div
              className="h-14 w-14 rounded-xl mb-4 flex items-center justify-center text-white text-xl font-bold"
              style={{ backgroundColor: data.color || '#3b82f6' }}
            >
              {data.name.charAt(0)}
            </div>
          )}
          <h1 className="text-2xl font-bold text-gray-900">{data.name}</h1>
          <p className="text-sm text-gray-500 mt-1">Client portal</p>
        </header>

        {data.urls.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Links</h2>
            <div className="space-y-2">
              {data.urls.map((url, i) => (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block px-4 py-3 rounded-lg bg-white border border-gray-200 hover:border-primary hover:bg-primary/5 text-primary font-medium"
                >
                  {i === 0 ? 'Dev / Staging' : i === 1 ? 'Live' : url}
                </a>
              ))}
            </div>
          </section>
        )}

        {data.assets.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Documents &amp; assets</h2>
            <div className="space-y-2">
              {data.assets.map((asset) => (
                <div
                  key={asset._id}
                  className="px-4 py-3 rounded-lg bg-white border border-gray-200"
                >
                  <span className="font-medium text-gray-900">{asset.name}</span>
                  <span className="text-xs text-gray-500 ml-2 capitalize">({asset.type})</span>
                  {asset.url && (
                    <a
                      href={asset.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block mt-1 text-sm text-primary hover:underline"
                    >
                      Open link
                    </a>
                  )}
                  {asset.fileUrl && (
                    <a
                      href={asset.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block mt-1 text-sm text-primary hover:underline"
                    >
                      Open file
                    </a>
                  )}
                  {asset.textContent && (
                    <div className="mt-2 text-sm text-gray-600 whitespace-pre-wrap border-t border-gray-100 pt-2">
                      {asset.textContent}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {data.contentCalendar.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Content calendar</h2>
            <div className="space-y-2">
              {data.contentCalendar.map((item) => (
                <div
                  key={item._id}
                  className="px-4 py-3 rounded-lg bg-white border border-gray-200 flex flex-wrap items-center gap-2"
                >
                  <span className="font-medium text-gray-900">{item.title}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">{item.channel}</span>
                  <span className="text-xs text-gray-500 capitalize">{item.status.replace('_', ' ')}</span>
                  {item.publishDate && (
                    <span className="text-xs text-gray-500 ml-auto">
                      {new Date(item.publishDate).toLocaleDateString()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {data.assets.length === 0 && data.contentCalendar.length === 0 && data.urls.length === 0 && (
          <p className="text-gray-500">No content shared yet.</p>
        )}
      </div>
    </div>
  );
}
