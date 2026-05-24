import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Nucleas OS',
};

export default function OSLayout({ children }: { children: React.ReactNode }) {
  return children;
}
