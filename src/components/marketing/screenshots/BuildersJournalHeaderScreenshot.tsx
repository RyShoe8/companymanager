import Image from 'next/image';

/** Static blog OG header — also used as reference for PNG export. */
export default function BuildersJournalHeaderScreenshot() {
  return (
    <div
      className="relative w-full aspect-[2.5/1] min-h-[200px] bg-background overflow-hidden pointer-events-none select-none"
      aria-hidden
    >
      <div className="absolute inset-0 bg-grid-pattern opacity-20" />
      <div className="absolute top-0 left-0 w-1/3 h-full bg-gradient-to-r from-primary/20 to-transparent" />
      <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-accent/20 to-transparent" />

      <div className="relative h-full flex items-center justify-between px-8 md:px-12">
        <div className="space-y-3 max-w-md">
          <div className="flex items-center gap-2">
            <Image src="/images/nucleas-logo.png" alt="" width={32} height={32} className="rounded-lg" />
            <span className="text-sm font-semibold text-primary">Nucleas</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-text-primary">The Builders Journal</h2>
          <p className="text-sm text-text-secondary">Build · Organize · Operate</p>
        </div>

        <div className="hidden md:block w-48 h-48 relative opacity-80">
          <div className="absolute inset-0 border border-primary/30 rounded-2xl rotate-6" />
          <div className="absolute inset-2 border border-accent/30 rounded-xl -rotate-3 bg-background-card/60" />
          <div className="absolute inset-4 flex flex-col gap-2 p-3">
            <div className="h-2 w-3/4 rounded bg-primary/40" />
            <div className="h-2 w-full rounded bg-white/10" />
            <div className="h-2 w-5/6 rounded bg-white/10" />
            <div className="h-2 w-2/3 rounded bg-accent/30" />
          </div>
        </div>
      </div>
    </div>
  );
}
