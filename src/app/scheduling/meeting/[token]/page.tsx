'use client';

import { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import MeetingDetailView from '@/components/scheduling/MeetingDetailView';

function MeetingPopoutContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const token = typeof params.token === 'string' ? params.token : '';
  const popout = searchParams?.get('popout') === '1';

  return <MeetingDetailView token={token} popout={popout} />;
}

export default function MeetingDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center text-text-muted">
          Loading…
        </div>
      }
    >
      <MeetingPopoutContent />
    </Suspense>
  );
}
