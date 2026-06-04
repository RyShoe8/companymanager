import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Recording',
};

export default function RecordingControlsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
