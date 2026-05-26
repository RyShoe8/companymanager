'use client';

import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import {
  DAY_LABELS_MON_FIRST,
  WEEK_DAYS_MON_FIRST,
  type AvailabilitySlotInput,
} from '@/lib/scheduling/availabilitySlots';

interface AvailabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  timezone: string;
  onTimezoneChange: (tz: string) => void;
  slots: AvailabilitySlotInput[];
  onUpdateSlot: (dayOfWeek: number, patch: Partial<AvailabilitySlotInput>) => void;
  onSave: () => Promise<boolean>;
  saving: boolean;
}

export default function AvailabilityModal({
  isOpen,
  onClose,
  timezone,
  onTimezoneChange,
  slots,
  onUpdateSlot,
  onSave,
  saving,
}: AvailabilityModalProps) {
  const orderedSlots = WEEK_DAYS_MON_FIRST.map((day) => slots.find((s) => s.dayOfWeek === day)).filter(
    (s): s is AvailabilitySlotInput => !!s
  );

  const handleSave = async () => {
    const ok = await onSave();
    if (ok) onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Weekly availability" maxWidth="lg">
      <div className="space-y-4">
        <label className="block text-sm text-text-secondary">
          Timezone
          <input
            type="text"
            value={timezone}
            onChange={(e) => onTimezoneChange(e.target.value)}
            className="block mt-1 w-full max-w-xs rounded border border-border bg-background px-2 py-1.5 text-sm text-text-primary"
          />
        </label>

        <div className="space-y-2">
          {orderedSlots.map((slot) => {
            const enabled = slot.enabled !== false;
            const outOfOffice = slot.outOfOffice === true;
            const timesDisabled = !enabled || outOfOffice;
            return (
              <div
                key={slot.dayOfWeek}
                className={`flex flex-wrap items-center gap-3 text-sm rounded-md px-2 py-1.5 ${
                  outOfOffice ? 'bg-muted/50 opacity-80' : ''
                }`}
              >
                <span className="w-10 text-text-secondary font-medium shrink-0">
                  {DAY_LABELS_MON_FIRST[slot.dayOfWeek]}
                </span>
                <label className="flex items-center gap-1.5 text-text-primary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enabled}
                    disabled={outOfOffice}
                    onChange={(e) =>
                      onUpdateSlot(slot.dayOfWeek, { enabled: e.target.checked })
                    }
                    className="rounded border-border"
                  />
                  <span className="text-xs text-text-secondary">Available</span>
                </label>
                <label className="flex items-center gap-1.5 text-text-primary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={outOfOffice}
                    onChange={(e) => {
                      const next = e.target.checked;
                      onUpdateSlot(slot.dayOfWeek, {
                        outOfOffice: next,
                        ...(next ? { enabled: false } : {}),
                      });
                    }}
                    className="rounded border-border"
                  />
                  <span className="text-xs text-text-secondary">Out of office</span>
                </label>
                <input
                  type="time"
                  value={slot.startTime}
                  disabled={timesDisabled}
                  onChange={(e) =>
                    onUpdateSlot(slot.dayOfWeek, { startTime: e.target.value })
                  }
                  className="rounded border border-border bg-background px-2 py-1 text-text-primary disabled:opacity-40 disabled:cursor-not-allowed"
                />
                <span className="text-text-muted">to</span>
                <input
                  type="time"
                  value={slot.endTime}
                  disabled={timesDisabled}
                  onChange={(e) =>
                    onUpdateSlot(slot.dayOfWeek, { endTime: e.target.value })
                  }
                  className="rounded border border-border bg-background px-2 py-1 text-text-primary disabled:opacity-40 disabled:cursor-not-allowed"
                />
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Saving…' : 'Save availability'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
