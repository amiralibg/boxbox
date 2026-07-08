import { Panel, SectionLabel } from "@/components/ui/Section";

/** Shimmering placeholder block. Size it with className. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

/** Pulsing status line for long jobs — always paired with words, never bare. */
export function LoadingLine({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 text-[12px] text-fog-500">
      <span className="h-1.5 w-1.5 animate-pulse bg-neon-cyan" />
      {children}
    </div>
  );
}

/**
 * Skeleton of the track-stage layout (track panel + sidebar) shown while a
 * session bakes or a feed connects. `note` explains what's happening — a
 * skeleton without words reads as a hang on a 45s bake.
 */
export function StageSkeleton({ label, note, sidebarRows = 8 }: { label: string; note?: string; sidebarRows?: number }) {
  return (
    <div className="mt-6 grid gap-5 md:mt-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <Panel className="min-w-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4">
          <SectionLabel>{label}</SectionLabel>
          {note && <span className="hidden font-mono text-[10px] text-fog-500 sm:block">{note}</span>}
        </div>
        <div className="p-4">
          <Skeleton className="aspect-[4/3] w-full" />
        </div>
      </Panel>
      <Panel className="p-4">
        <Skeleton className="h-3 w-24" />
        <div className="mt-4 space-y-2.5">
          {Array.from({ length: sidebarRows }).map((_, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <Skeleton className="h-3 w-5" />
              <Skeleton className="h-3 flex-1" />
              <Skeleton className="h-3 w-10" />
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

/** Grid of shimmering cards (H2H pairs, chart panels…). */
export function CardsSkeleton({ count = 4, className = "" }: { count?: number; className?: string }) {
  return (
    <div className={`grid gap-4 md:grid-cols-2 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <Panel key={i} className="p-5">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="mt-4 h-5 w-3/4" />
          <div className="mt-4 space-y-2.5">
            <Skeleton className="h-2.5 w-full" />
            <Skeleton className="h-2.5 w-full" />
            <Skeleton className="h-2.5 w-2/3" />
          </div>
        </Panel>
      ))}
    </div>
  );
}
