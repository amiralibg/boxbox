export function SectionLabel({ children, accent = "var(--color-red)", className = "" }: { children: React.ReactNode; accent?: string; className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <span className="h-2 w-[2px] shrink-0" style={{ backgroundColor: accent }} />
      <span className="font-mono text-[10px] font-medium tracking-[0.16em] text-ink-3">{children}</span>
    </div>
  );
}

export function PageTitle({ title, sub, index }: { title: string; sub: string; index?: string }) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between md:gap-10">
      <div className="min-w-0">
        {index && (
          <span className="font-mono text-[10px] tracking-[0.2em] text-red">
            {index}
          </span>
        )}
        <h1 className="display mt-2 text-[38px] font-bold leading-[0.98] md:text-[54px]">
          {title}
        </h1>
      </div>
      <p className="max-w-lg border-l border-ink/20 pl-4 font-mono text-[10px] leading-5 text-ink-2 md:shrink-0 md:pb-1">{sub}</p>
    </div>
  );
}

/** Guidance placeholder for a stage that has no data yet. */
export function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="mt-6 flex flex-col items-center border-y border-ink/15 px-6 py-14 text-center md:mt-8 md:py-20">
      <p className="text-[18px] font-semibold">{title}</p>
      <p className="mt-2 max-w-sm text-[12px] leading-relaxed text-ink-2">{hint}</p>
    </div>
  );
}

/** Panel: paper surface bounded by a hairline rule — no fills, no shadows. */
export function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`border border-ink/15 bg-paper/95 ${className}`}>{children}</div>;
}

export function CapabilityNotice({
  source,
  children,
  tone = "neutral",
}: {
  source: string;
  children: React.ReactNode;
  tone?: "neutral" | "warning";
}) {
  return (
    <div className={`flex gap-3 border px-3 py-2 font-mono text-[10px] leading-4 ${
      tone === "warning" ? "border-ochre/35 bg-ochre/5 text-ochre" : "border-ink/15 bg-paper-2 text-ink-2"
    }`}>
      <span className="shrink-0 text-ink-3">{source.toUpperCase()}</span>
      <span>{children}</span>
    </div>
  );
}
