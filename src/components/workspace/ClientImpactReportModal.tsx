'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import TimeHorizonSelector from '@/components/planning-map/TimeHorizonSelector';
import ClientImpactReportView from '@/components/workspace/ClientImpactReportView';
import type { ClientImpactReportData } from '@/lib/clients/buildClientImpactReport';
import type { TimeframeType } from '@/lib/utils/dateUtils';
import { getCalendarPeriodTitle } from '@/lib/utils/calendarPeriodNav';

interface ClientImpactReportModalProps {
  isOpen: boolean;
  clientId: string;
  clientName: string;
  onClose: () => void;
}

function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function ClientImpactReportModal({
  isOpen,
  clientId,
  clientName,
  onClose,
}: ClientImpactReportModalProps) {
  const [timeframe, setTimeframe] = useState<TimeframeType>('monthly');
  const [referenceDate, setReferenceDate] = useState(() => toDateInputValue(new Date()));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ClientImpactReportData | null>(null);

  const handleClose = () => {
    setReport(null);
    setError(null);
    onClose();
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const ref = new Date(`${referenceDate}T12:00:00`);
      const params = new URLSearchParams({
        timeframe,
        referenceDate: ref.toISOString(),
      });
      const res = await fetch(`/api/clients/${clientId}/impact-report?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to generate report');
      }
      const data = (await res.json()) as ClientImpactReportData;
      setReport(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const refDateObj = new Date(`${referenceDate}T12:00:00`);
  const periodPreview = getCalendarPeriodTitle(timeframe, refDateObj);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={report ? `Impact Report — ${clientName}` : `Generate Impact Report — ${clientName}`}
      maxWidth={report ? '4xl' : 'md'}
    >
      {!report ? (
        <div className="space-y-5">
          <p className="text-sm text-text-secondary">
            Choose a reporting period. The report summarizes completed tasks, published content, meetings, and active
            projects for this client.
          </p>
          <div>
            <p className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-2">Timeframe</p>
            <TimeHorizonSelector selected={timeframe} onSelect={setTimeframe} />
          </div>
          <div>
            <label className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-2 block">
              Reference date
            </label>
            <input
              type="date"
              value={referenceDate}
              onChange={(e) => setReferenceDate(e.target.value)}
              className="w-full max-w-xs px-3 py-2 border border-border bg-background rounded-lg text-sm text-text-primary"
            />
            <p className="text-xs text-text-tertiary mt-2">Period: {periodPreview}</p>
          </div>
          {error && <p className="text-sm text-error">{error}</p>}
          <div className="flex gap-2 justify-end impact-report-modal-chrome">
            <Button variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={() => void handleGenerate()} disabled={loading}>
              {loading ? 'Generating…' : 'Generate'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 justify-end impact-report-modal-chrome print:hidden">
            <Button variant="secondary" onClick={() => setReport(null)}>
              Back
            </Button>
            <Button variant="secondary" onClick={() => window.print()}>
              Print / Save PDF
            </Button>
            <Button onClick={handleClose}>Close</Button>
          </div>
          <ClientImpactReportView data={report} />
        </div>
      )}
    </Modal>
  );
}
