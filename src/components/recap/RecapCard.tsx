import type { RecapData } from "@/lib/db/queries";

export const CARD_W = 1200;
export const CARD_H = 675;

const PAPER = "#f6f1e5";
const INK = "#1c1710";
const INK_2 = "#5b5442";
const MUTED = "#8d8470";
const LINE = "#ddd5bf";
const RED = "#c8102e";
const SERIF = "'Fraunces', Georgia, serif";
const MONO = "'JetBrains Mono', monospace";

/**
 * Season recap card, 16:9, print-editorial. Pure self-contained SVG (inline
 * styles only) so the existing ExportLayer can serialize it with the embedded
 * fonts. The title-arc draw-in animation lives in page CSS, not here —
 * exports stay static.
 */
export function RecapCard({ data, accent }: { data: RecapData; accent: string }) {
  // ----- title arc geometry -----
  const chart = { x: 610, y: 120, w: 510, h: 210 };
  const maxPts = Math.max(1, ...data.arc.map((a) => Math.max(a.self, a.rival)));
  const n = data.arc.length;
  const px = (i: number) => chart.x + (n < 2 ? 0 : (chart.w * i) / (n - 1));
  const py = (v: number) => chart.y + chart.h - (chart.h * v) / maxPts;
  const line = (pick: (a: RecapData["arc"][number]) => number) =>
    data.arc.map((a, i) => `${i === 0 ? "M" : "L"}${px(i).toFixed(1)} ${py(pick(a)).toFixed(1)}`).join("");

  // ----- rounds strip -----
  const strip = { x: 610, y: 395, w: 510 };
  const cell = Math.min(24, strip.w / Math.max(1, data.rounds.length));
  const roundFill = (r: RecapData["rounds"][number]) => {
    if (!r.classified) return "none";
    if (r.position === 1) return accent;
    if (r.position != null && r.position <= 3) return `${accent}77`;
    if (r.points > 0) return "#aca38b";
    return "#e5dcc4";
  };

  const stat = (label: string, value: string | number, x: number) => (
    <g>
      <text x={x} y={556} fontSize={12} letterSpacing={3} fill={MUTED} fontFamily={MONO}>{label}</text>
      <text x={x} y={608} fontSize={46} fontWeight={800} fill={INK} fontFamily={SERIF}>{value}</text>
    </g>
  );

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${CARD_W} ${CARD_H}`} width={CARD_W} height={CARD_H}>
      <rect width={CARD_W} height={CARD_H} fill={PAPER} />

      {/* masthead */}
      <text x={70} y={72} fontSize={13} letterSpacing={4} fill={INK_2} fontFamily={MONO}>
        FORMULA 1 · SEASON RECAP
      </text>
      <text x={CARD_W - 70} y={72} fontSize={13} letterSpacing={4} fill={INK_2} textAnchor="end" fontFamily={MONO}>
        {data.year}
      </text>
      <rect x={70} y={86} width={CARD_W - 140} height={3} fill={INK} />
      <line x1={70} y1={94} x2={CARD_W - 70} y2={94} stroke={INK} strokeWidth={1} />

      {/* driver block */}
      <text x={70} y={186} fontSize={40} fontStyle="italic" fontWeight={300} fill={INK_2} fontFamily={SERIF}>
        {data.firstName}
      </text>
      <text x={70} y={262} fontSize={72} fontWeight={800} fill={INK} fontFamily={SERIF}>
        {data.lastName.toUpperCase()}
        <tspan fill={accent}>.</tspan>
      </text>
      <rect x={70} y={286} width={56} height={3} fill={accent} />
      <text x={70} y={326} fontSize={14} letterSpacing={2} fill={MUTED} fontFamily={MONO}>
        {data.teams.join(" · ").toUpperCase()}
      </text>

      {/* final position, oversized */}
      {data.finalPosition != null && (
        <g>
          <text x={70} y={470} fontSize={120} fontWeight={900} fill={accent} fontFamily={SERIF}>
            P{data.finalPosition}
          </text>
          <text
            x={78 + (data.finalPosition >= 10 ? 230 : 160)}
            y={466}
            fontSize={13}
            letterSpacing={3}
            fill={MUTED}
            fontFamily={MONO}
          >
            CHAMPIONSHIP
          </text>
        </g>
      )}

      {/* title arc */}
      <g fontFamily={MONO}>
        <text x={chart.x} y={chart.y - 14} fontSize={12} letterSpacing={3} fill={MUTED}>
          TITLE ARC — CUMULATIVE POINTS VS {data.rivalName.toUpperCase()}
        </text>
        <line x1={chart.x} y1={chart.y + chart.h} x2={chart.x + chart.w} y2={chart.y + chart.h} stroke={LINE} strokeWidth={1} />
        <path d={line((a) => a.rival)} fill="none" stroke={MUTED} strokeWidth={1.75} strokeDasharray="5 4" opacity={0.8} />
        <path d={line((a) => a.self)} fill="none" stroke={accent} strokeWidth={2.5} className="rc-arc" />
        {(() => {
          const selfV = data.arc[n - 1]?.self ?? 0;
          const rivalV = data.arc[n - 1]?.rival ?? 0;
          let ySelf = py(selfV) + 4;
          let yRival = py(rivalV) + 4;
          // pull colliding end labels apart
          if (Math.abs(ySelf - yRival) < 15) {
            const mid = (ySelf + yRival) / 2;
            ySelf = mid + (selfV >= rivalV ? -8 : 8);
            yRival = mid + (selfV >= rivalV ? 8 : -8);
          }
          const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
          return (
            <>
              <text x={chart.x + chart.w + 8} y={ySelf} fontSize={13} fontWeight={700} fill={accent}>{fmt(selfV)}</text>
              <text x={chart.x + chart.w + 8} y={yRival} fontSize={13} fill={MUTED}>{fmt(rivalV)}</text>
            </>
          );
        })()}
      </g>

      {/* rounds strip */}
      <g fontFamily={MONO}>
        <text x={strip.x} y={strip.y - 12} fontSize={12} letterSpacing={3} fill={MUTED}>
          ROUND BY ROUND
        </text>
        {data.rounds.map((r, i) => {
          const x = strip.x + i * cell;
          const fill = roundFill(r);
          return (
            <g key={r.round}>
              {fill === "none" ? (
                <g stroke={RED} strokeWidth={1.5}>
                  <line x1={x + 3} y1={strip.y + 3} x2={x + cell - 9} y2={strip.y + cell - 9} />
                  <line x1={x + cell - 9} y1={strip.y + 3} x2={x + 3} y2={strip.y + cell - 9} />
                </g>
              ) : (
                <rect x={x} y={strip.y} width={cell - 6} height={cell - 6} fill={fill} />
              )}
              {(i === 0 || (r.round % 5 === 0 && i > 1)) && (
                <text x={x} y={strip.y + cell + 12} fontSize={10} fill={MUTED}>R{r.round}</text>
              )}
            </g>
          );
        })}
        <g fontSize={11} fill={MUTED}>
          <rect x={strip.x} y={strip.y + 44} width={10} height={10} fill={accent} />
          <text x={strip.x + 16} y={strip.y + 53}>WIN</text>
          <rect x={strip.x + 60} y={strip.y + 44} width={10} height={10} fill={`${accent}77`} />
          <text x={strip.x + 76} y={strip.y + 53}>PODIUM</text>
          <rect x={strip.x + 150} y={strip.y + 44} width={10} height={10} fill="#aca38b" />
          <text x={strip.x + 166} y={strip.y + 53}>POINTS</text>
          <text x={strip.x + 238} y={strip.y + 53} fill={RED}>✕ DNF</text>
        </g>
      </g>

      {/* stats row */}
      {stat("WINS", data.wins, 70)}
      {stat("PODIUMS", data.podiums, 210)}
      {stat("POLES", data.poles, 390)}
      {stat("POINTS", data.points, 530)}
      {stat("FASTEST LAPS", data.fastestLaps, 730)}

      {/* footer */}
      <line x1={70} y1={628} x2={CARD_W - 70} y2={628} stroke={LINE} strokeWidth={1} />
      <text x={70} y={652} fontSize={16} fontWeight={800} fill={INK} fontFamily={SERIF}>
        BoxBox<tspan fill={accent}>.</tspan>
      </text>
      <text x={CARD_W - 70} y={650} fontSize={10} letterSpacing={2} fill={MUTED} textAnchor="end" fontFamily={MONO}>
        DATA · F1DB
      </text>
    </svg>
  );
}
