import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Nucleas OS',
};

export default function OSLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-black text-white">
      <aside className="w-64 border-r border-zinc-800 p-4 shrink-0">
        <h1 className="text-xl font-bold">Nucleas OS</h1>
        <p className="text-sm text-zinc-500 mt-2">Experimental workspace shell</p>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
