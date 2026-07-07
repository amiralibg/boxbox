import { lapLengthMeters, makeProjector, toClosedPath, type BakedCircuit } from "@/lib/track/geometry";

export const POSTER_W = 900;
export const POSTER_H = 1200;

export interface PosterOptions {
  accent: string;
  showCorners: boolean;
  round?: number;
}

/**
 * Pure SVG poster. Rendered live for preview and serialized as-is for
 * SVG/PNG export, so everything must be self-contained (no CSS classes —
 * the exported file has no stylesheet).
 */
export function Poster({ circuit, accent, showCorners, round }: PosterOptions & { circuit: BakedCircuit }) {
  const viewport = { x: 100, y: 150, width: POSTER_W - 200, height: 590 };
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
  const nameSize = Math.min(72, (POSTER_W - 180) / (name.length * 0.68));
  // drop location/country parts that just repeat the title (e.g. Monaco, Spa)
  const subtitle = [...new Set([circuit.location, circuit.country])]
    .filter((p) => p.toUpperCase() !== name)
    .join(" · ")
    .toUpperCase() || circuit.country.toUpperCase();

  const label = (text: string, x: number, anchor: "start" | "middle" | "end") => (
    <text x={x} y={1052} fontSize={13} letterSpacing={3} fill="#7e7c92" textAnchor={anchor} fontFamily="'Space Grotesk', sans-serif">
      {text}
    </text>
  );
  const value = (text: string, x: number, anchor: "start" | "middle" | "end") => (
    <text x={x} y={1090} fontSize={30} fontWeight={500} fill="#eceaf6" textAnchor={anchor} fontFamily="'Space Grotesk', sans-serif">
      {text}
    </text>
  );

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${POSTER_W} ${POSTER_H}`} width={POSTER_W} height={POSTER_H}>
      <defs>
        <filter id="glow-soft" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
        <filter id="glow-tight" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
        <radialGradient id="vignette" cx="50%" cy="38%" r="75%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.07" />
          <stop offset="55%" stopColor={accent} stopOpacity="0.02" />
          <stop offset="100%" stopColor="#08080d" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width={POSTER_W} height={POSTER_H} fill="#0b0b12" />
      <rect width={POSTER_W} height={POSTER_H} fill="url(#vignette)" />

      {/* header */}
      <text x={100} y={96} fontSize={14} letterSpacing={4} fill="#7e7c92" fontFamily="'Space Grotesk', sans-serif">
        FORMULA 1{round ? ` — ROUND ${String(round).padStart(2, "0")}` : ""}
      </text>
      <text x={POSTER_W - 100} y={96} fontSize={14} letterSpacing={4} fill="#7e7c92" textAnchor="end" fontFamily="'Space Grotesk', sans-serif">
        {circuit.year}
      </text>
      <line x1={100} y1={116} x2={POSTER_W - 100} y2={116} stroke="#23232f" strokeWidth={1} />

      {/* track */}
      <path d={trackPath} fill="none" stroke={accent} strokeWidth={20} strokeLinejoin="round" opacity={0.22} filter="url(#glow-soft)" />
      <path d={trackPath} fill="none" stroke={accent} strokeWidth={9} strokeLinejoin="round" opacity={0.55} filter="url(#glow-tight)" />
      <path d={trackPath} fill="none" stroke={accent} strokeWidth={5} strokeLinejoin="round" />

      {/* start / finish */}
      <circle cx={start[0]} cy={start[1]} r={10} fill="#0b0b12" stroke="#eceaf6" strokeWidth={3} />

      {/* corners */}
      {cornerLabels.map((c) => (
        <g key={c.n}>
          <circle cx={c.px} cy={c.py} r={3} fill="#eceaf6" opacity={0.85} />
          <text x={c.x} y={c.y + 4.5} fontSize={14} fontWeight={500} fill="#b9b7c9" textAnchor="middle" fontFamily="'Space Grotesk', sans-serif">
            {c.n}
          </text>
        </g>
      ))}

      {/* divider */}
      <line x1={100} y1={830} x2={POSTER_W - 100} y2={830} stroke="#23232f" strokeWidth={1} />
      <rect x={100} y={828} width={56} height={5} fill={accent} />

      {/* title block */}
      <text x={100} y={920} fontSize={nameSize} fontWeight={700} letterSpacing={2} fill="#eceaf6" fontFamily="'Space Grotesk', sans-serif">
        {name}
      </text>
      <text x={100} y={962} fontSize={17} letterSpacing={5} fill="#7e7c92" fontFamily="'Space Grotesk', sans-serif">
        {subtitle}
      </text>

      {/* stats */}
      {label("LENGTH", 100, "start")}
      {value(`${(lapLengthMeters(circuit) / 1000).toFixed(2)} KM`, 100, "start")}
      {label("TURNS", POSTER_W / 2, "middle")}
      {value(String(circuit.corners.length), POSTER_W / 2, "middle")}
      {label("SEASON", POSTER_W - 100, "end")}
      {value(String(circuit.year), POSTER_W - 100, "end")}

      {/* footer */}
      <rect x={100} y={1134} width={10} height={10} fill={accent} />
      <text x={118} y={1144} fontSize={14} fontWeight={700} letterSpacing={3} fill="#eceaf6" fontFamily="'Space Grotesk', sans-serif">
        BOXBOX
      </text>
      <text x={POSTER_W - 100} y={1144} fontSize={11} letterSpacing={2} fill="#7e7c92" textAnchor="end" fontFamily="'Space Grotesk', sans-serif">
        F1 LIVE TIMING DATA
      </text>
    </svg>
  );
}
