'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  normalizeAvailabilitySlots,
  sortSlotsMonFirst,
  type AvailabilitySlotInput,
} from '@/lib/scheduling/availabilitySlots';

export function useSchedulingAvailability() {
  const [slots, setSlots] = useState<AvailabilitySlotInput[]>([]);
  const [timezone, setTimezone] = useState('America/New_York');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadAvailability = useCallback(async () => {
    const res = await fetch('/api/scheduling/availability');
    if (res.ok) {
      const data = await res.json();
      setSlots(sortSlotsMonFirst(normalizeAvailabilitySlots(data.slots)));
      setTimezone(data.timezone || 'America/New_York');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await loadAvailability();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadAvailability]);

  const saveAvailability = useCallback(async (): Promise<boolean> => {
    setSaving(true);
    try {
      const res = await fetch('/api/scheduling/availability', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timezone, slots: normalizeAvailabilitySlots(slots) }),
      });
      return res.ok;
    } finally {
      setSaving(false);
    }
  }, [timezone, slots]);

  const updateSlotByDay = useCallback((dayOfWeek: number, patch: Partial<AvailabilitySlotInput>) => {
    setSlots((prev) =>
      prev.map((s) => (s.dayOfWeek === dayOfWeek ? { ...s, ...patch } : s))
    );
  }, []);

  return {
    slots,
    timezone,
    setTimezone,
    loading,
    saving,
    loadAvailability,
    saveAvailability,
    updateSlotByDay,
  };
}
