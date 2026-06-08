import type { ItemSeenStatus } from '@/lib/workspace/itemSeenState';

interface ItemSeenTagProps {
  status: ItemSeenStatus;
}

export default function ItemSeenTag({ status }: ItemSeenTagProps) {
  if (status === 'none') return null;
  return (
    <span className="mr-1 inline-flex items-center rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
      {status === 'new' ? 'New' : 'Updated'}
    </span>
  );
}
