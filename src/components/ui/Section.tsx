/** The BoxBox section motif: accent tick + tracked caps label. */
export function SectionLabel({ children, accent = "#2de2e6", className = "" }: { children: React.ReactNode; accent?: string; className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <span className="h-[3px] w-7 shrink-0" style={{ backgroundColor: accent }} />
      <span className="text-[11px] font-medium tracking-[0.22em] text-fog-500">{children}</span>
    </div>
  );
}

/**
 * Page heading: kerb strip + index number over an oversized tight title,
 * standfirst pushed to the right edge on desktop. The one loud element per
 * page — everything below it stays quiet.
 */
export function PageTitle({ title, sub, index }: { title: string; sub: string; index?: string }) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between md:gap-10">
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <span className="kerb h-[6px] w-14 shrink-0" />
          {index && <span className="font-mono text-[11px] tracking-[0.3em] text-fog-500">{index}</span>}
        </div>
        <h1 className="mt-3 text-[40px] font-bold leading-[0.95] tracking-[-0.02em] md:text-[56px]">{title}</h1>
      </div>
      <p className="max-w-md text-[13px] leading-relaxed text-fog-500 md:shrink-0 md:pb-1.5 md:text-right">{sub}</p>
    </div>
  );
}

/** Guidance placeholder for a stage that has no data yet. */
export function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="mt-6 flex flex-col items-center border border-dashed border-ink-600 px-6 py-14 text-center md:mt-8 md:py-20">
      <span className="kerb h-[5px] w-16 opacity-50" />
      <p className="mt-4 text-[14px] font-semibold text-fog-300">{title}</p>
      <p className="mt-1.5 max-w-sm text-[12px] leading-relaxed text-fog-500">{hint}</p>
    </div>
  );
}

/** Panel: flat surface, hairline border, no rounding on top of rounding. */
export function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`border border-ink-700/70 bg-ink-900 ${className}`}>{children}</div>;
}
