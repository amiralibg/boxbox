import type { RecapData } from "@/lib/db/recap";

export const CARD_W = 1200;
export const CARD_H = 675;

const PAPER = "#eef2f1";
const INK = "#111718";
const SANS = "'Space Grotesk', sans-serif";
const MONO = "'JetBrains Mono', monospace";

export type RecapStatKey = "wins" | "podiums" | "poles" | "points" | "fastestLaps";

export interface RecapCardOptions {
  accent: string;
  background?: string;
  ink?: string;
  visibleStats?: RecapStatKey[];
  showGrid?: boolean;
  showArc?: boolean;
  showRounds?: boolean;
  showPosition?: boolean;
  customLabel?: string;
}

/** Self-contained technical season report for SVG/PNG export. */
export function RecapCard({
  data,
  accent,
  background = PAPER,
  ink = INK,
  visibleStats = ["wins", "podiums", "poles", "points", "fastestLaps"],
  showGrid = true,
  showArc = true,
  showRounds = true,
  showPosition = true,
  customLabel,
}: { data: RecapData } & RecapCardOptions) {
  const chart = { x: 610, y: 145, w: 500, h: 225 };
  const maxPoints = Math.max(1, ...data.arc.map((point) => Math.max(point.self, point.rival)));
  const count = data.arc.length;
  const px = (index: number) => chart.x + (count < 2 ? 0 : chart.w * index / (count - 1));
  const py = (value: number) => chart.y + chart.h - chart.h * value / maxPoints;
  const path = (pick: (point: RecapData["arc"][number]) => number) =>
    data.arc.map((point, index) => `${index === 0 ? "M" : "L"}${px(index).toFixed(1)} ${py(pick(point)).toFixed(1)}`).join("");
  const strip = { x: 610, y: 445, w: 500 };
  const cell = strip.w / Math.max(1, data.rounds.length);
  const lastSelf = data.arc[count - 1]?.self ?? 0;
  const lastRival = data.arc[count - 1]?.rival ?? 0;
  const nameSize = Math.min(76, 390 / Math.max(5, data.lastName.length * 0.55));
  const labels: Record<RecapStatKey, string> = {
    wins: "WINS",
    podiums: "PODIUMS",
    poles: "POLES",
    points: "POINTS",
    fastestLaps: "FASTEST LAPS",
  };

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${CARD_W} ${CARD_H}`} width={CARD_W} height={CARD_H}>
      <defs>
        <pattern id="recap-grid" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M24 0H0V24" fill="none" stroke={ink} strokeOpacity={0.045} />
        </pattern>
      </defs>
      <rect width={CARD_W} height={CARD_H} fill={background} />
      {showGrid && <rect x={36} y={36} width={1128} height={603} fill="url(#recap-grid)" />}
      <rect x={36} y={36} width={1128} height={603} fill="none" stroke={ink} strokeOpacity={0.22} />
      <line x1={565} y1={94} x2={565} y2={611} stroke={ink} strokeOpacity={0.18} />

      <g fontFamily={MONO}>
        <rect x={36} y={36} width={8} height={58} fill={accent} />
        <text x={60} y={61} fontSize={11} fontWeight={700} letterSpacing={2.2} fill={ink}>{(customLabel?.trim() || "BB / SEASON PERFORMANCE REPORT").toUpperCase()}</text>
        <text x={60} y={82} fontSize={8.5} letterSpacing={1.5} fill={ink} opacity={0.48}>DRIVER CHAMPIONSHIP / PUBLISHED RESULTS</text>
        <text x={1140} y={61} textAnchor="end" fontSize={12} fontWeight={700} fill={accent}>{data.year}</text>
        <text x={1140} y={82} textAnchor="end" fontSize={8.5} letterSpacing={1.5} fill={ink} opacity={0.48}>F1DB / {String(data.rounds.length).padStart(2, "0")} ROUNDS</text>
      </g>
      <line x1={60} y1={110} x2={1140} y2={110} stroke={ink} strokeOpacity={0.2} />
      <line x1={60} y1={110} x2={244} y2={110} stroke={accent} strokeWidth={3} />

      <g>
        <text x={72} y={169} fontFamily={MONO} fontSize={10} letterSpacing={2} fill={ink} opacity={0.48}>DRIVER / {data.driverId.toUpperCase()}</text>
        <text x={72} y={222} fontFamily={SANS} fontSize={30} fontWeight={400} fill={ink} opacity={0.58}>{data.firstName.toUpperCase()}</text>
        <text x={68} y={292} fontFamily={SANS} fontSize={nameSize} fontWeight={700} letterSpacing={-2.5} fill={ink}>{data.lastName.toUpperCase()}</text>
        <rect x={72} y={316} width={74} height={4} fill={accent} />
        <text x={72} y={350} fontFamily={MONO} fontSize={10} letterSpacing={1.4} fill={ink} opacity={0.52}>{data.teams.join(" / ").toUpperCase()}</text>

        {showPosition && data.finalPosition != null && (
          <g>
            <text x={68} y={485} fontFamily={SANS} fontSize={126} fontWeight={700} letterSpacing={-7} fill={accent}>P{data.finalPosition}</text>
            <text x={75} y={514} fontFamily={MONO} fontSize={9} letterSpacing={2} fill={ink} opacity={0.48}>FINAL CHAMPIONSHIP POSITION</text>
          </g>
        )}
      </g>

      {showArc && (
        <g fontFamily={MONO}>
          <text x={chart.x} y={chart.y - 24} fontSize={9} letterSpacing={1.8} fill={accent}>CUMULATIVE POINTS TRACE</text>
          <text x={chart.x + chart.w} y={chart.y - 24} textAnchor="end" fontSize={8.5} fill={ink} opacity={0.45}>VS {data.rivalName.toUpperCase()}</text>
          {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
            <g key={fraction}>
              <line x1={chart.x} y1={chart.y + chart.h * fraction} x2={chart.x + chart.w} y2={chart.y + chart.h * fraction} stroke={ink} strokeOpacity={fraction === 1 ? 0.24 : 0.08} />
              <text x={chart.x - 12} y={chart.y + chart.h * fraction + 3} textAnchor="end" fontSize={7.5} fill={ink} opacity={0.36}>{Math.round(maxPoints * (1 - fraction))}</text>
            </g>
          ))}
          <path d={path((point) => point.rival)} fill="none" stroke={ink} strokeOpacity={0.36} strokeWidth={2} strokeDasharray="6 5" />
          <path d={path((point) => point.self)} fill="none" stroke={accent} strokeWidth={3} className="rc-arc" />
          <circle cx={px(count - 1)} cy={py(lastSelf)} r={5} fill={accent} />
          <circle cx={px(count - 1)} cy={py(lastRival)} r={4} fill={background} stroke={ink} strokeOpacity={0.6} />
          <text x={chart.x + chart.w - 4} y={py(lastSelf) - 11} textAnchor="end" fontSize={10} fontWeight={700} fill={accent}>{lastSelf}</text>
          <text x={chart.x + chart.w - 4} y={py(lastRival) + 17} textAnchor="end" fontSize={9} fill={ink} opacity={0.52}>{lastRival}</text>
        </g>
      )}

      {showRounds && (
        <g fontFamily={MONO}>
          <text x={strip.x} y={strip.y - 18} fontSize={9} letterSpacing={1.8} fill={accent}>ROUND RESULT MATRIX</text>
          {data.rounds.map((round, index) => {
            const x = strip.x + index * cell;
            const classified = round.classified;
            const opacity = round.position === 1 ? 1 : round.position != null && round.position <= 3 ? 0.58 : round.points > 0 ? 0.25 : 0.08;
            return (
              <g key={round.round}>
                <rect x={x} y={strip.y} width={Math.max(2, cell - 3)} height={36} fill={classified ? accent : "none"} fillOpacity={opacity} stroke={classified ? ink : accent} strokeOpacity={classified ? 0.14 : 0.8} />
                {!classified && <path d={`M${x + 3} ${strip.y + 3}L${x + cell - 6} ${strip.y + 33}M${x + cell - 6} ${strip.y + 3}L${x + 3} ${strip.y + 33}`} stroke={accent} />}
                {(index === 0 || round.round % 5 === 0) && <text x={x} y={strip.y + 52} fontSize={7.5} fill={ink} opacity={0.42}>R{round.round}</text>}
              </g>
            );
          })}
          <g transform={`translate(${strip.x} ${strip.y + 78})`} fontSize={8} fill={ink} opacity={0.5}>
            <rect width={9} height={9} fill={accent} opacity={1} /><text x={15} y={8}>WIN</text>
            <rect x={58} width={9} height={9} fill={accent} opacity={0.58} /><text x={73} y={8}>PODIUM</text>
            <rect x={150} width={9} height={9} fill={accent} opacity={0.25} /><text x={165} y={8}>POINTS</text>
            <rect x={238} width={9} height={9} fill="none" stroke={accent} /><text x={253} y={8}>DNF / DNS</text>
          </g>
        </g>
      )}

      <g transform="translate(60 557)">
        {visibleStats.map((key, index) => {
          const width = 490 / visibleStats.length;
          const x = index * width;
          return (
            <g key={key} transform={`translate(${x} 0)`}>
              {index > 0 && <line y1={0} y2={52} stroke={ink} strokeOpacity={0.15} />}
              <text x={index > 0 ? 16 : 0} y={10} fontFamily={MONO} fontSize={7.5} letterSpacing={1.2} fill={ink} opacity={0.46}>{labels[key]}</text>
              <text x={index > 0 ? 16 : 0} y={47} fontFamily={SANS} fontSize={28} fontWeight={650} fill={ink}>{data[key]}</text>
            </g>
          );
        })}
      </g>

      <g fontFamily={MONO}>
        <text x={590} y={617} fontSize={8} letterSpacing={1.3} fill={ink} opacity={0.4}>COMPARISON / {data.rivalName.toUpperCase()}</text>
        <text x={1140} y={617} textAnchor="end" fontSize={8} letterSpacing={1.3} fill={ink} opacity={0.4}>BOXBOX DATA STUDIO / F1DB</text>
      </g>
    </svg>
  );
}
