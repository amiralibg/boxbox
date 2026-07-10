import { lapLengthMeters, makeProjector, toClosedPath, type BakedCircuit } from "@/lib/track/geometry";

export const POSTER_W = 900;
export const POSTER_H = 1200;

const PAPER = "#eef2f1";
const INK = "#111718";
const SANS = "'Space Grotesk', sans-serif";
const MONO = "'JetBrains Mono', monospace";

export interface PosterOptions {
  accent: string;
  showCorners: boolean;
  round?: number;
  background?: string;
  ink?: string;
  lineWidth?: number;
  showStart?: boolean;
  showGrid?: boolean;
  showStats?: boolean;
  customTitle?: string;
  customSubtitle?: string;
}

/** Self-contained SVG engineering plate built from live-timing geometry. */
export function Poster({
  circuit,
  accent,
  showCorners,
  round,
  background = PAPER,
  ink = INK,
  lineWidth = 7,
  showStart = true,
  showGrid = true,
  showStats = true,
  customTitle,
  customSubtitle,
}: PosterOptions & { circuit: BakedCircuit }) {
  const viewport = { x: 82, y: 270, width: 736, height: 590 };
  const { project, trackScreen } = makeProjector(circuit, viewport);
  const trackPath = toClosedPath(trackScreen);
  const start = trackScreen[0];
  const cx = trackScreen.reduce((sum, point) => sum + point[0], 0) / trackScreen.length;
  const cy = trackScreen.reduce((sum, point) => sum + point[1], 0) / trackScreen.length;
  const name = (customTitle?.trim() || circuit.name).toUpperCase();
  const nameSize = Math.min(70, 720 / Math.max(8, name.length * 0.58));
  const subtitle = customSubtitle?.trim()
    || [...new Set([circuit.location, circuit.country])].filter((part) => part.toUpperCase() !== name).join(" / ")
    || circuit.country;
  const lengthKm = lapLengthMeters(circuit) / 1000;
  const corners = showCorners
    ? circuit.corners.map((corner) => {
        const [px, py] = project([corner.x, corner.y]);
        const dx = px - cx;
        const dy = py - cy;
        const distance = Math.hypot(dx, dy) || 1;
        const offset = Math.hypot(px - start[0], py - start[1]) < 35 ? 48 : 24;
        return { number: corner.number, px, py, x: px + (dx / distance) * offset, y: py + (dy / distance) * offset };
      })
    : [];
  const stats = [
    ["LAP LENGTH", `${lengthKm.toFixed(3)} KM`],
    ["CORNERS", String(circuit.corners.length).padStart(2, "0")],
    ["DATA POINTS", circuit.x.length.toLocaleString("en-US")],
    ["LAYOUT", String(circuit.year)],
  ];

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${POSTER_W} ${POSTER_H}`} width={POSTER_W} height={POSTER_H}>
      <defs>
        <pattern id="poster-grid-small" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0H0V20" fill="none" stroke={ink} strokeOpacity={0.055} strokeWidth={1} />
        </pattern>
        <pattern id="poster-grid-large" width="100" height="100" patternUnits="userSpaceOnUse">
          <rect width="100" height="100" fill="url(#poster-grid-small)" />
          <path d="M100 0H0V100" fill="none" stroke={ink} strokeOpacity={0.09} strokeWidth={1} />
        </pattern>
      </defs>
      <rect width={POSTER_W} height={POSTER_H} fill={background} />
      {showGrid && <rect x={52} y={52} width={796} height={1096} fill="url(#poster-grid-large)" />}
      <rect x={52} y={52} width={796} height={1096} fill="none" stroke={ink} strokeOpacity={0.24} />

      <g fontFamily={MONO}>
        <rect x={52} y={52} width={8} height={56} fill={accent} />
        <text x={76} y={76} fontSize={11} fontWeight={700} letterSpacing={2.4} fill={ink}>BB / CIRCUIT GEOMETRY</text>
        <text x={76} y={97} fontSize={9} letterSpacing={1.7} fill={ink} opacity={0.52}>LIVE-TIMING COORDINATE TRACE</text>
        <text x={824} y={76} fontSize={11} fontWeight={700} textAnchor="end" fill={accent}>{circuit.year}.{String(round ?? 0).padStart(2, "0")}</text>
        <text x={824} y={97} fontSize={9} textAnchor="end" letterSpacing={1.5} fill={ink} opacity={0.52}>CK {circuit.circuitKey}</text>
      </g>

      <text x={76} y={177} fontFamily={SANS} fontSize={nameSize} fontWeight={700} letterSpacing={-2.4} fill={ink}>{name}</text>
      <text x={78} y={211} fontFamily={MONO} fontSize={11} letterSpacing={2.2} fill={ink} opacity={0.58}>{subtitle.toUpperCase()}</text>
      <line x1={76} y1={234} x2={824} y2={234} stroke={ink} strokeOpacity={0.2} />
      <line x1={76} y1={234} x2={226} y2={234} stroke={accent} strokeWidth={3} />

      <rect x={67} y={252} width={766} height={632} fill={background} fillOpacity={0.38} stroke={ink} strokeOpacity={0.14} />
      <path d={trackPath} fill="none" stroke={ink} strokeOpacity={0.1} strokeWidth={lineWidth + 15} strokeLinejoin="round" strokeLinecap="round" />
      <path d={trackPath} fill="none" stroke={accent} strokeWidth={lineWidth} strokeLinejoin="round" strokeLinecap="round" />

      {showStart && (
        <g transform={`translate(${start[0]} ${start[1]})`}>
          <circle r={15} fill={background} stroke={accent} strokeWidth={2} />
          <line x1={-22} y1={0} x2={22} y2={0} stroke={ink} strokeOpacity={0.65} />
          <line x1={0} y1={-22} x2={0} y2={22} stroke={ink} strokeOpacity={0.65} />
          <circle r={3.5} fill={accent} />
        </g>
      )}
      {corners.map((corner) => (
        <g key={corner.number} fontFamily={MONO}>
          <line x1={corner.px} y1={corner.py} x2={corner.x} y2={corner.y} stroke={ink} strokeOpacity={0.3} strokeWidth={0.8} />
          <circle cx={corner.px} cy={corner.py} r={2.3} fill={background} stroke={ink} />
          <circle cx={corner.x} cy={corner.y} r={11} fill={background} stroke={ink} strokeOpacity={0.45} />
          <text x={corner.x} y={corner.y + 3.5} fontSize={8.5} fontWeight={700} fill={ink} textAnchor="middle">{corner.number}</text>
        </g>
      ))}

      {showStats && (
        <g transform="translate(76 924)">
          <text fontFamily={MONO} fontSize={9} letterSpacing={1.8} fill={accent}>LAYOUT SPECIFICATION</text>
          <line x1={0} y1={18} x2={748} y2={18} stroke={ink} strokeOpacity={0.2} />
          {stats.map(([label, value], index) => {
            const x = index * 187;
            return (
              <g key={label} transform={`translate(${x} 46)`}>
                {index > 0 && <line x1={0} y1={-14} x2={0} y2={82} stroke={ink} strokeOpacity={0.14} />}
                <text x={index > 0 ? 20 : 0} y={0} fontFamily={MONO} fontSize={8.5} letterSpacing={1.4} fill={ink} opacity={0.48}>{label}</text>
                <text x={index > 0 ? 20 : 0} y={38} fontFamily={SANS} fontSize={24} fontWeight={650} fill={ink}>{value}</text>
              </g>
            );
          })}
        </g>
      )}

      <g fontFamily={MONO}>
        <line x1={76} y1={1090} x2={824} y2={1090} stroke={ink} strokeOpacity={0.2} />
        <text x={76} y={1123} fontSize={10} fontWeight={700} letterSpacing={2} fill={ink}>BOXBOX / DATA STUDIO</text>
        <text x={824} y={1123} fontSize={8.5} letterSpacing={1.4} textAnchor="end" fill={ink} opacity={0.5}>SOURCE OPENF1 + MULTIVIEWER / UNITS ≈ 0.1 M</text>
        <text transform="translate(30 1148) rotate(-90)" fontSize={8} letterSpacing={2.3} fill={ink} opacity={0.36}>FORMULA ONE TECHNICAL PLATE / {circuit.shortName.toUpperCase()}</text>
      </g>
    </svg>
  );
}
