import type { RecapData } from "@/lib/db/queries";

export const CARD_W = 1200;
export const CARD_H = 675;

const INK = "#0b0b12";
const FOG = "#eceaf6";
const MUTED = "#7e7c92";
const LINE = "#23232f";
const FONT = "'Space Grotesk', sans-serif";

/**
 * Season recap card, 16:9. Pure self-contained SVG (inline styles only) so the
 * existing ExportLayer can serialize it with the embedded font. The title-arc
 * draw-in animation lives in page CSS, not here — exports stay static.
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
    if (r.position != null && r.position <= 3) return `${accent}88`;
    if (r.points > 0) return "#4a4a5c";
    return "#23232f";
  };

  const stat = (label: string, value: string | number, x: number) => (
    <g>
      <text x={x} y={556} fontSize={13} letterSpacing={3} fill={MUTED} fontFamily={FONT}>{label}</text>
      <text x={x} y={608} fontSize={46} fontWeight={700} fill={FOG} fontFamily={FONT}>{value}</text>
    </g>
  );

  // perspective grid, the one synthwave flourish
  const horizonY = 675;
  const gridLines: string[] = [];
  for (let i = 0; i <= 8; i++) {
    const gx = 540 + i * 110;
    gridLines.push(`M${gx} ${horizonY} L${600 + (gx - 600) * 0.55} 470`);
  }

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${CARD_W} ${CARD_H}`} width={CARD_W} height={CARD_H}>
      <defs>
        <radialGradient id="rc-glow" cx="12%" cy="10%" r="80%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.13" />
          <stop offset="60%" stopColor={accent} stopOpacity="0.03" />
          <stop offset="100%" stopColor={INK} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="rc-fade" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor={accent} stopOpacity="0.35" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </linearGradient>
        <filter id="rc-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>

      <rect width={CARD_W} height={CARD_H} fill={INK} />
      <rect width={CARD_W} height={CARD_H} fill="url(#rc-glow)" />
      <g stroke="url(#rc-fade)" strokeWidth={1}>
        {gridLines.map((d, i) => (
          <path key={i} d={d} fill="none" />
        ))}
      </g>

      {/* header */}
      <text x={70} y={78} fontSize={14} letterSpacing={4} fill={MUTED} fontFamily={FONT}>
        FORMULA 1 · SEASON RECAP
      </text>
      <text x={CARD_W - 70} y={78} fontSize={14} letterSpacing={4} fill={MUTED} textAnchor="end" fontFamily={FONT}>
        {data.year}
      </text>
      <line x1={70} y1={98} x2={CARD_W - 70} y2={98} stroke={LINE} strokeWidth={1} />

      {/* driver block */}
      <text x={70} y={190} fontSize={44} fontWeight={500} fill={MUTED} fontFamily={FONT}>
        {data.firstName.toUpperCase()}
      </text>
      <text x={70} y={262} fontSize={72} fontWeight={700} letterSpacing={1} fill={FOG} fontFamily={FONT}>
        {data.lastName.toUpperCase()}
      </text>
      <rect x={70} y={288} width={56} height={5} fill={accent} />
      <text x={70} y={330} fontSize={17} letterSpacing={2} fill={MUTED} fontFamily={FONT}>
        {data.teams.join(" · ").toUpperCase()}
      </text>

      {/* final position, oversized */}
      {data.finalPosition != null && (
        <g fontFamily={FONT}>
          <text x={70} y={470} fontSize={120} fontWeight={700} fill="none" stroke={accent} strokeWidth={2}>
            P{data.finalPosition}
          </text>
          <text x={78 + (data.finalPosition >= 10 ? 220 : 150)} y={470} fontSize={15} letterSpacing={3} fill={MUTED}>
            CHAMPIONSHIP
          </text>
        </g>
      )}

      {/* title arc */}
      <g fontFamily={FONT}>
        <text x={chart.x} y={chart.y - 14} fontSize={13} letterSpacing={3} fill={MUTED}>
          TITLE ARC — CUMULATIVE POINTS VS {data.rivalName.toUpperCase()}
        </text>
        <line x1={chart.x} y1={chart.y + chart.h} x2={chart.x + chart.w} y2={chart.y + chart.h} stroke={LINE} strokeWidth={1} />
        <path d={line((a) => a.rival)} fill="none" stroke={MUTED} strokeWidth={2} strokeDasharray="5 4" opacity={0.7} />
        <path d={line((a) => a.self)} fill="none" stroke={accent} strokeWidth={4} opacity={0.5} filter="url(#rc-blur)" className="rc-arc" />
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
              <text x={chart.x + chart.w + 8} y={ySelf} fontSize={13} fontWeight={600} fill={accent}>{fmt(selfV)}</text>
              <text x={chart.x + chart.w + 8} y={yRival} fontSize={13} fill={MUTED}>{fmt(rivalV)}</text>
            </>
          );
        })()}
      </g>

      {/* rounds strip */}
      <g fontFamily={FONT}>
        <text x={strip.x} y={strip.y - 12} fontSize={13} letterSpacing={3} fill={MUTED}>
          ROUND BY ROUND
        </text>
        {data.rounds.map((r, i) => {
          const x = strip.x + i * cell;
          const fill = roundFill(r);
          return (
            <g key={r.round}>
              {fill === "none" ? (
                <g stroke="#ff2d78" strokeWidth={1.5}>
                  <line x1={x + 3} y1={strip.y + 3} x2={x + cell - 9} y2={strip.y + cell - 9} />
                  <line x1={x + cell - 9} y1={strip.y + 3} x2={x + 3} y2={strip.y + cell - 9} />
                </g>
              ) : (
                <rect x={x} y={strip.y} width={cell - 6} height={cell - 6} rx={3} fill={fill} />
              )}
              {(i === 0 || (r.round % 5 === 0 && i > 1)) && (
                <text x={x} y={strip.y + cell + 12} fontSize={10} fill={MUTED}>R{r.round}</text>
              )}
            </g>
          );
        })}
        <g fontSize={11} fill={MUTED}>
          <rect x={strip.x} y={strip.y + 44} width={10} height={10} rx={2} fill={accent} />
          <text x={strip.x + 16} y={strip.y + 53}>WIN</text>
          <rect x={strip.x + 60} y={strip.y + 44} width={10} height={10} rx={2} fill={`${accent}88`} />
          <text x={strip.x + 76} y={strip.y + 53}>PODIUM</text>
          <rect x={strip.x + 150} y={strip.y + 44} width={10} height={10} rx={2} fill="#4a4a5c" />
          <text x={strip.x + 166} y={strip.y + 53}>POINTS</text>
          <text x={strip.x + 238} y={strip.y + 53} fill="#ff2d78">✕ DNF</text>
        </g>
      </g>

      {/* stats row */}
      {stat("WINS", data.wins, 70)}
      {stat("PODIUMS", data.podiums, 210)}
      {stat("POLES", data.poles, 390)}
      {stat("POINTS", data.points, 530)}
      {stat("FASTEST LAPS", data.fastestLaps, 730)}

      {/* footer */}
      <rect x={70} y={636} width={10} height={10} fill={accent} />
      <text x={88} y={646} fontSize={14} fontWeight={700} letterSpacing={3} fill={FOG} fontFamily={FONT}>
        BOXBOX
      </text>
      <text x={CARD_W - 70} y={646} fontSize={11} letterSpacing={2} fill={MUTED} textAnchor="end" fontFamily={FONT}>
        DATA · F1DB
      </text>
    </svg>
  );
}
