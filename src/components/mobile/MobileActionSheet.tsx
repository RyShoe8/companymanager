'use client';

import BottomSheet from '@/components/ui/BottomSheet';
import { useMobileShell, type MobileInboxItem } from '@/contexts/MobileShellContext';
import { markOpenedFromActionInbox } from '@/lib/mobile/actionInboxReturn';

type MobileActionSheetProps = {
  isOpen: boolean;
  onClose: () => void;
};

function groupLabel(type: MobileInboxItem['type']): string {
  switch (type) {
    case 'task':
      return 'Tasks';
    case 'content':
      return 'Content';
    case 'project':
      return 'Projects';
    case 'client':
      return 'Clients';
    default:
      return 'Items';
  }
}

export default function MobileActionSheet({ isOpen, onClose }: MobileActionSheetProps) {
  const { inboxItems } = useMobileShell();

  const grouped = inboxItems.reduce<Record<string, MobileInboxItem[]>>((acc, item) => {
    const key = groupLabel(item.type);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const sections = Object.entries(grouped);

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="For you" maxHeight="85vh" elevated>
      {sections.length === 0 ? (
        <p className="text-sm text-text-muted px-1 py-4">
          No new assignments or updates right now. Check back after tasks or content are assigned to
          you.
        </p>
      ) : (
        <div className="space-y-5">
          {sections.map(([section, items]) => (
            <div key={section}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-2 px-1">
                {section}
              </h3>
              <ul className="space-y-1">
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        markOpenedFromActionInbox(item.id);
                        item.onOpen();
                        onClose();
                      }}
                      className="w-full flex items-start gap-2 px-3 py-2.5 rounded-lg hover:bg-background-elevated text-left"
                    >
                      <span
                        className={`shrink-0 mt-0.5 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                          item.status === 'new'
                            ? 'bg-primary/15 text-primary'
                            : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {item.status}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-text-primary truncate">
                          {item.label}
                        </span>
                        {item.subtitle ? (
                          <span className="block text-xs text-text-muted truncate">
                            {item.subtitle}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </BottomSheet>
  );
}
