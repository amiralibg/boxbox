"use client";

import { useEffect, useState } from "react";
import { SectionLabel } from "@/components/ui/Section";
import type { ReplayBlob, ReplayTelemetry } from "@/lib/replay/types";
import type { TelemetryPlayer } from "@/lib/telemetry/player";

const valueAt = (values: number[], hz: number, t: number) =>
  values[Math.min(values.length - 1, Math.max(0, Math.round(t * hz)))] ?? 0;

export function DriverTelemetryPanel({
  blob,
  player,
  selected,
  onSelect,
}: {
  blob: ReplayBlob;
  player: TelemetryPlayer;
  selected: number;
  onSelect: (num: number) => void;
}) {
  const [data, setData] = useState<ReplayTelemetry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [values, setValues] = useState({ speed: 0, throttle: 0, brake: 0, rpm: 0, gear: 0, drs: 0 });

  useEffect(() => {
    let stale = false;
    setData(null);
    setError(null);
    fetch(`/api/replay/${blob.sessionKey}/telemetry/${selected}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? String(response.status));
        return body as ReplayTelemetry;
      })
      .then((next) => !stale && setData(next))
      .catch((reason) => !stale && setError(String(reason)));
    return () => { stale = true; };
  }, [blob.sessionKey, selected, attempt]);

  useEffect(() => {
    if (!data) return;
    let last = -1;
    return player.subscribe((t) => {
      if (t - last < 0.1 && player.playing) return;
      last = t;
      setValues({
        speed: valueAt(data.speed, data.hz, t),
        throttle: valueAt(data.throttle, data.hz, t),
        brake: valueAt(data.brake, data.hz, t),
        rpm: valueAt(data.rpm, data.hz, t),
        gear: valueAt(data.gear, data.hz, t),
        drs: valueAt(data.drs, data.hz, t),
      });
    });
  }, [data, player]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/15 px-4 py-3">
        <SectionLabel>DRIVER TELEMETRY · {data?.hz ?? 2} HZ</SectionLabel>
        <div className="flex flex-wrap gap-1">
          {blob.drivers.map((driver) => (
            <button key={driver.num} onClick={() => onSelect(driver.num)} className={`px-2 py-1 font-mono text-[9px] ${selected === driver.num ? "bg-red text-white" : "bg-paper-2 text-ink-2 hover:text-ink"}`}>
              {driver.acronym}
            </button>
          ))}
        </div>
      </div>
      {error && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 font-mono text-[10px] text-red">
          <span>{error}</span>
          <button type="button" onClick={() => setAttempt((value) => value + 1)} className="border border-red/40 px-3 py-1.5 hover:bg-red hover:text-white">
            RETRY CHANNEL
          </button>
        </div>
      )}
      {!data && !error && <div className="p-6 font-mono text-[10px] text-ink-3">LOADING LAZY DRIVER CHANNEL…</div>}
      {data && (
        <div className="grid grid-cols-2 gap-px bg-ink/10 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["SPEED", values.speed, "KM/H"],
            ["THROTTLE", values.throttle, "%"],
            ["BRAKE", values.brake, values.brake ? "ON" : "OFF"],
            ["RPM", values.rpm, "RPM"],
            ["GEAR", values.gear, "GEAR"],
            ["DRS", values.drs, values.drs >= 10 ? "OPEN" : "CLOSED"],
          ].map(([label, value, unit]) => (
            <div key={String(label)} className="bg-paper p-4">
              <div className="font-mono text-[9px] tracking-[0.16em] text-ink-3">{label}</div>
              <div className="mt-2 font-mono text-2xl tabular-nums">{value}</div>
              <div className="mt-1 font-mono text-[9px] text-ink-3">{unit}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
