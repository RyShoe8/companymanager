import type { Metadata } from 'next';
import OsRoot from '@/components/os/OsRoot';

export const metadata: Metadata = {
  title: 'Nucleas OS',
};

export default function OSLayout({ children }: { children: React.ReactNode }) {
  return <OsRoot>{children}</OsRoot>;
}
