/**
 * Timing-screen table. Mono numerals, hairline rows, F1 colour conventions:
 * purple = best overall, green = personal/relative best. Wrap lives inside —
 * wide tables scroll horizontally on their own, never the page.
 */

export type CellTone = "default" | "muted" | "best" | "pb" | "accent";

export interface TimingCell {
  text: React.ReactNode;
  tone?: CellTone;
  /** explicit colour (e.g. team colour chips) — overrides tone */
  color?: string;
}

export interface TimingColumn {
  key: string;
  header: string;
  align?: "left" | "right" | "center";
  minWidth?: number;
}

export interface TimingRow {
  key: string;
  cells: Record<string, TimingCell | string | number>;
}

const toneClass: Record<CellTone, string> = {
  default: "text-fog-100",
  muted: "text-fog-500",
  best: "text-[--color-sector-best] font-semibold",
  pb: "text-[--color-sector-pb] font-semibold",
  accent: "text-neon-cyan font-semibold",
};

export function TimingTable({ columns, rows, dense = false }: { columns: TimingColumn[]; rows: TimingRow[]; dense?: boolean }) {
  return (
    <div className="panel-scroll w-full overflow-x-auto">
      <table className="w-full border-collapse whitespace-nowrap">
        <thead>
          <tr className="border-b border-ink-600">
            {columns.map((c) => (
              <th
                key={c.key}
                style={{ minWidth: c.minWidth }}
                className={`px-2 py-2.5 text-[10px] first:pl-3 last:pr-3 font-medium tracking-[0.2em] text-fog-500 ${
                  c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left"
                }`}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b border-ink-700/50 last:border-b-0 hover:bg-ink-800/60">
              {columns.map((c) => {
                const raw = r.cells[c.key];
                const cell: TimingCell = typeof raw === "object" && raw !== null && "text" in raw ? raw : { text: raw as React.ReactNode };
                return (
                  <td
                    key={c.key}
                    style={cell.color ? { color: cell.color } : undefined}
                    className={`px-2 font-mono text-[12px] tabular-nums first:pl-3 last:pr-3 ${dense ? "py-1.5" : "py-2.5"} ${
                      c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left"
                    } ${cell.color ? "" : toneClass[cell.tone ?? "default"]}`}
                  >
                    {cell.text}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- minisectors ---------------- */

/** OpenF1 segment codes → timing-screen colours */
const SEGMENT_COLOR: Record<number, string> = {
  2048: "var(--color-sector-set)", // completed, no improvement
  2049: "var(--color-sector-pb)", // personal best
  2051: "var(--color-sector-best)", // overall best
  2052: "var(--color-fog-500)", // unknown
  2064: "var(--color-tyre-wet)", // pit lane
};

export function segmentColor(code: number): string {
  return SEGMENT_COLOR[code] ?? "var(--color-ink-600)";
}

/**
 * Minisector strip — one block per timing segment, sectors separated by a
 * small gap. The live-timing "purple / green / yellow" read at a glance.
 */
export function SegmentStrip({ segments, className = "" }: { segments: [number[], number[], number[]]; className?: string }) {
  if (segments.every((s) => s.length === 0)) return null;
  return (
    <span className={`inline-flex items-center gap-[5px] align-middle ${className}`}>
      {segments.map((sector, si) => (
        <span key={si} className="inline-flex gap-[2px]">
          {sector.map((code, i) => (
            <span key={i} className="h-[9px] w-[5px]" style={{ backgroundColor: segmentColor(code) }} />
          ))}
        </span>
      ))}
    </span>
  );
}

/* ---------------- tyres ---------------- */

const COMPOUND_STYLE: Record<string, { color: string; letter: string }> = {
  SOFT: { color: "var(--color-tyre-soft)", letter: "S" },
  MEDIUM: { color: "var(--color-tyre-medium)", letter: "M" },
  HARD: { color: "var(--color-tyre-hard)", letter: "H" },
  INTERMEDIATE: { color: "var(--color-tyre-inter)", letter: "I" },
  WET: { color: "var(--color-tyre-wet)", letter: "W" },
};

export function compoundStyle(compound: string | null | undefined) {
  return COMPOUND_STYLE[(compound ?? "").toUpperCase()] ?? { color: "var(--color-fog-500)", letter: "?" };
}

/** Pirelli-style compound ring. */
export function TyreChip({ compound, title }: { compound: string | null | undefined; title?: string }) {
  const s = compoundStyle(compound);
  return (
    <span
      title={title ?? compound ?? undefined}
      className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 align-middle font-mono text-[10px] font-bold"
      style={{ borderColor: s.color, color: s.color }}
    >
      {s.letter}
    </span>
  );
}
