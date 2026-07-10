"use client";

import { useEffect, useRef } from "react";
import type { WeatherSample } from "@/lib/replay/types";
import type { TelemetryPlayer } from "@/lib/telemetry/player";

/**
 * One mono line of conditions at the playback clock: air/track temp, wind,
 * humidity, rain. Weather samples arrive ~1/min, so nearest-sample lookup.
 */
export function WeatherStrip({ weather, player }: { weather: WeatherSample[]; player: TelemetryPlayer }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (weather.length === 0) return;
    let last = -60;
    const unsub = player.subscribe((t) => {
      if (Math.abs(t - last) < 5 && player.playing) return;
      last = t;
      // binary search the nearest sample at or before t
      let lo = 0;
      let hi = weather.length - 1;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (weather[mid].t <= t) lo = mid;
        else hi = mid;
      }
      const w = weather[hi].t <= t ? weather[hi] : weather[lo];
      if (ref.current) {
        ref.current.textContent =
          `AIR ${w.airTemp.toFixed(0)}° · TRACK ${w.trackTemp.toFixed(0)}° · ` +
          `WIND ${w.windSpeed.toFixed(1)} M/S · HUM ${w.humidity.toFixed(0)}% · ` +
          `RAIN ${w.rainfall > 0 ? "YES" : "—"}`;
      }
    });
    return unsub;
  }, [weather, player]);

  if (weather.length === 0) return null;
  return <span ref={ref} className="font-mono text-[10px] tracking-wider text-ink-3" />;
}
