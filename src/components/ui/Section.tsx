/** The BoxBox section motif: short red tick + tracked caps label. */
export function SectionLabel({ children, accent = "var(--color-red)", className = "" }: { children: React.ReactNode; accent?: string; className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <span className="h-[2px] w-5 shrink-0" style={{ backgroundColor: accent }} />
      <span className="text-[11px] font-medium tracking-[0.22em] text-ink-3">{children}</span>
    </div>
  );
}

/**
 * Page heading: folio line over an oversized serif title that ends on a red
 * full stop, standfirst pushed to the right edge on desktop. The one loud
 * element per page — everything below it stays quiet.
 */
export function PageTitle({ title, sub, index }: { title: string; sub: string; index?: string }) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between md:gap-10">
      <div className="min-w-0">
        {index && (
          <span className="font-mono text-[11px] tracking-[0.3em] text-red">
            {index}
          </span>
        )}
        <h1 className="display mt-2 text-[42px] font-black leading-[0.98] md:text-[58px]">
          {title}
          <span className="text-red">.</span>
        </h1>
      </div>
      <p className="max-w-md text-[13px] leading-relaxed text-ink-2 md:shrink-0 md:pb-2 md:text-right">{sub}</p>
    </div>
  );
}

/** Guidance placeholder for a stage that has no data yet. */
export function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="mt-6 flex flex-col items-center border-y border-ink/15 px-6 py-14 text-center md:mt-8 md:py-20">
      <p className="display text-[20px] font-semibold italic">{title}</p>
      <p className="mt-2 max-w-sm text-[12px] leading-relaxed text-ink-2">{hint}</p>
    </div>
  );
}

/** Panel: paper surface bounded by a hairline rule — no fills, no shadows. */
export function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`border border-ink/15 bg-paper ${className}`}>{children}</div>;
}
