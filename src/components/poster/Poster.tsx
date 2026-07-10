import { lapLengthMeters, makeProjector, toClosedPath, type BakedCircuit } from "@/lib/track/geometry";

export const POSTER_W = 900;
export const POSTER_H = 1200;

const PAPER = "#f6f1e5";
const INK = "#1c1710";
const INK_2 = "#5b5442";
const MUTED = "#8d8470";
const SERIF = "'Fraunces', Georgia, serif";
const MONO = "'JetBrains Mono', monospace";

export interface PosterOptions {
  accent: string;
  showCorners: boolean;
  round?: number;
}

/**
 * Pure SVG poster, print-editorial: paper ground, the racing line in one
 * accent colour, serif masthead. Rendered live for preview and serialized
 * as-is for SVG/PNG export, so everything must be self-contained (no CSS
 * classes — the exported file has no stylesheet).
 */
export function Poster({ circuit, accent, showCorners, round }: PosterOptions & { circuit: BakedCircuit }) {
  const viewport = { x: 100, y: 165, width: POSTER_W - 200, height: 575 };
  const { project, trackScreen } = makeProjector(circuit, viewport);
  const trackPath = toClosedPath(trackScreen);

  const start = trackScreen[0];
  const cx = trackScreen.reduce((a, p) => a + p[0], 0) / trackScreen.length;
  const cy = trackScreen.reduce((a, p) => a + p[1], 0) / trackScreen.length;

  const cornerLabels = showCorners
    ? circuit.corners.map((c) => {
        const [px, py] = project([c.x, c.y]);
        const dx = px - cx;
        const dy = py - cy;
        const d = Math.hypot(dx, dy) || 1;
        // push the label clear of the start/finish marker if they collide
        const near = Math.hypot(px + (dx / d) * 26 - start[0], py + (dy / d) * 26 - start[1]) < 34;
        const off = near ? 60 : 26;
        return { n: c.number, x: px + (dx / d) * off, y: py + (dy / d) * off, px, py };
      })
    : [];

  const name = circuit.name.toUpperCase();
  const nameSize = Math.min(76, (POSTER_W - 190) / (name.length * 0.64));
  // drop location/country parts that just repeat the title (e.g. Monaco, Spa)
  const subtitle =
    [...new Set([circuit.location, circuit.country])]
      .filter((p) => p.toUpperCase() !== name)
      .join(" · ") || circuit.country;

  const label = (text: string, x: number, anchor: "start" | "middle" | "end") => (
    <text x={x} y={1050} fontSize={12} letterSpacing={3} fill={MUTED} textAnchor={anchor} fontFamily={MONO}>
      {text}
    </text>
  );
  const value = (text: string, x: number, anchor: "start" | "middle" | "end") => (
    <text x={x} y={1092} fontSize={32} fontWeight={600} fill={INK} textAnchor={anchor} fontFamily={SERIF}>
      {text}
    </text>
  );

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${POSTER_W} ${POSTER_H}`} width={POSTER_W} height={POSTER_H}>
      <rect width={POSTER_W} height={POSTER_H} fill={PAPER} />

      {/* masthead */}
      <text x={100} y={92} fontSize={13} letterSpacing={4} fill={INK_2} fontFamily={MONO}>
        FORMULA 1{round ? ` — ROUND ${String(round).padStart(2, "0")}` : ""}
      </text>
      <text x={POSTER_W - 100} y={92} fontSize={13} letterSpacing={4} fill={INK_2} textAnchor="end" fontFamily={MONO}>
        {circuit.year}
      </text>
      {/* newspaper double rule */}
      <rect x={100} y={108} width={POSTER_W - 200} height={3} fill={INK} />
      <line x1={100} y1={116} x2={POSTER_W - 100} y2={116} stroke={INK} strokeWidth={1} />

      {/* the racing line */}
      <path d={trackPath} fill="none" stroke={accent} strokeWidth={6.5} strokeLinejoin="round" />

      {/* start / finish */}
      <circle cx={start[0]} cy={start[1]} r={9} fill={PAPER} stroke={INK} strokeWidth={3} />

      {/* corners */}
      {cornerLabels.map((c) => (
        <g key={c.n}>
          <circle cx={c.px} cy={c.py} r={2.5} fill={INK} opacity={0.8} />
          <text x={c.x} y={c.y + 4.5} fontSize={13} fill={INK_2} textAnchor="middle" fontFamily={MONO}>
            {c.n}
          </text>
        </g>
      ))}

      {/* divider */}
      <line x1={100} y1={830} x2={POSTER_W - 100} y2={830} stroke={INK} strokeOpacity={0.25} strokeWidth={1} />
      <rect x={100} y={828} width={56} height={3} fill={accent} />

      {/* title block */}
      <text x={100} y={922} fontSize={nameSize} fontWeight={800} fill={INK} fontFamily={SERIF}>
        {name}
        <tspan fill={accent}>.</tspan>
      </text>
      <text x={100} y={962} fontSize={19} fontStyle="italic" fill={INK_2} fontFamily={SERIF}>
        {subtitle}
      </text>

      {/* stats */}
      {label("LENGTH", 100, "start")}
      {value(`${(lapLengthMeters(circuit) / 1000).toFixed(2)} km`, 100, "start")}
      {label("TURNS", POSTER_W / 2, "middle")}
      {value(String(circuit.corners.length), POSTER_W / 2, "middle")}
      {label("SEASON", POSTER_W - 100, "end")}
      {value(String(circuit.year), POSTER_W - 100, "end")}

      {/* footer */}
      <line x1={100} y1={1128} x2={POSTER_W - 100} y2={1128} stroke={INK} strokeOpacity={0.25} strokeWidth={1} />
      <text x={100} y={1158} fontSize={17} fontWeight={800} fill={INK} fontFamily={SERIF}>
        BoxBox<tspan fill={accent}>.</tspan>
      </text>
      <text x={POSTER_W - 100} y={1156} fontSize={10} letterSpacing={2} fill={MUTED} textAnchor="end" fontFamily={MONO}>
        F1 LIVE TIMING DATA
      </text>
    </svg>
  );
}
