'use client';

import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';

export default function CreatePlanButton() {
  const router = useRouter();
  return (
    <Button type="button" onClick={() => router.push('/admin/plans/new')}>
      Create plan
    </Button>
  );
}
