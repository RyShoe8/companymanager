'use client';

import { PlatformGuideProvider } from '@/lib/platformGuide/PlatformGuideProvider';

export default function PlatformGuideLayoutWrapper({ children }: { children: React.ReactNode }) {
  return <PlatformGuideProvider>{children}</PlatformGuideProvider>;
}
