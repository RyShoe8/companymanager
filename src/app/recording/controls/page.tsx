'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Button from '@/components/ui/Button';
import {
  postRecordingPopoutMessage,
  subscribeRecordingPopoutMessages,
} from '@/lib/recordings/recordingPopoutSync';

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function RecordingControlsContent() {
  const searchParams = useSearchParams();
  const isPopout = searchParams?.get('popout') === '1';
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!isPopout) return;

    postRecordingPopoutMessage({ type: 'ready' });

    const unsubscribe = subscribeRecordingPopoutMessages((message) => {
      if (message.type === 'tick') {
        setElapsedSeconds(message.elapsedSeconds);
      }
    });

    const onBeforeUnload = () => {
      postRecordingPopoutMessage({ type: 'closed' });
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      unsubscribe();
    };
  }, [isPopout]);

  const handleStop = () => {
    postRecordingPopoutMessage({ type: 'stop' });
    window.close();
  };

  if (!isPopout) {
    return (
      <div className="h-dvh overflow-hidden flex items-center justify-center bg-white text-gray-700 text-sm p-4">
        Open recording controls from the Create menu while recording.
      </div>
    );
  }

  return (
    <div className="h-dvh overflow-hidden bg-white flex items-center justify-center px-3">
      <div className="flex items-center gap-3 w-full max-w-[320px]">
        <span className="flex items-center gap-2 text-sm font-medium text-gray-900 shrink-0">
          <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" aria-hidden />
          Recording
        </span>
        <span className="font-mono text-sm text-gray-600 tabular-nums flex-1 text-center">
          {formatElapsed(elapsedSeconds)}
        </span>
        <Button type="button" size="sm" onClick={handleStop}>
          Stop
        </Button>
      </div>
    </div>
  );
}

export default function RecordingControlsPage() {
  return (
    <Suspense
      fallback={
        <div className="h-dvh overflow-hidden flex items-center justify-center bg-white text-gray-600 text-sm">
          Loading…
        </div>
      }
    >
      <RecordingControlsContent />
    </Suspense>
  );
}
