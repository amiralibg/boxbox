"use client";

import { useEffect, useRef, useState } from "react";
import { SectionLabel } from "@/components/ui/Section";
import type { ReplayBlob, ReplayDriver } from "@/lib/replay/types";
import type { TelemetryPlayer } from "@/lib/telemetry/player";

const fmtClock = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = Math.floor(seconds % 60);
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
};

type PlaybackState = {
  key: string | null;
  state: "idle" | "loading" | "playing" | "paused" | "error";
  message?: string;
};

export function TeamRadioPanel({
  radio,
  drivers,
  player,
}: {
  radio: ReplayBlob["radio"];
  drivers: Map<number, ReplayDriver>;
  player: TelemetryPlayer;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [playback, setPlayback] = useState<PlaybackState>({ key: null, state: "idle" });

  useEffect(() => () => {
    audioRef.current?.pause();
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
  }, []);

  const clearAudio = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
  };

  const toggleClip = async (key: string, time: number, sourceUrl: string) => {
    if (playback.key === key && audioRef.current) {
      if (audioRef.current.paused) {
        try {
          await audioRef.current.play();
          setPlayback({ key, state: "playing" });
        } catch {
          setPlayback({ key, state: "error", message: "Browser could not decode this clip." });
        }
      } else {
        audioRef.current.pause();
        setPlayback({ key, state: "paused" });
      }
      return;
    }

    clearAudio();
    setPlayback({ key, state: "loading" });
    player.pause();
    player.seek(time);

    try {
      const response = await fetch(`/api/replay/radio?url=${encodeURIComponent(sourceUrl)}`);
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error ?? `Radio archive returned ${response.status}.`);
      }
      const clip = await response.blob();
      if (!clip.type.startsWith("audio/")) throw new Error("Radio archive did not return audio.");

      const objectUrl = URL.createObjectURL(clip);
      objectUrlRef.current = objectUrl;
      const audio = new Audio(objectUrl);
      audioRef.current = audio;
      audio.onended = () => setPlayback({ key: null, state: "idle" });
      audio.onerror = () => setPlayback({ key, state: "error", message: "Browser could not decode this clip." });
      try {
        await audio.play();
        setPlayback({ key, state: "playing" });
      } catch (error) {
        if (error instanceof DOMException && error.name === "NotAllowedError") {
          setPlayback({ key, state: "paused", message: "Clip loaded. Press play again to start audio." });
          return;
        }
        throw error;
      }
    } catch (error) {
      clearAudio();
      setPlayback({
        key,
        state: "error",
        message: error instanceof Error ? error.message : "Radio clip unavailable.",
      });
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-ink/15 px-4 py-3">
        <SectionLabel>TEAM RADIO · SYNCHRONIZED SOURCE CLIPS</SectionLabel>
        <span className="max-w-md font-mono text-[9px] leading-4 text-ink-3">
          SOURCE: FORMULA ONE ARCHIVE · HISTORICAL AVAILABILITY VARIES
        </span>
      </div>
      <div className="panel-scroll grid max-h-64 overflow-y-auto md:grid-cols-2">
        {Object.entries(radio).flatMap(([number, clips]) =>
          clips.map((clip, index) => {
            const key = `${number}-${index}`;
            const driver = drivers.get(Number(number));
            const active = playback.key === key;
            return (
              <div key={key} className="border-b border-ink/10 p-3 odd:md:border-r">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void toggleClip(key, clip.t, clip.url)}
                    disabled={active && playback.state === "loading"}
                    className="grid h-8 w-8 shrink-0 place-items-center border border-ink/20 bg-paper-2 font-mono text-[10px] text-red hover:border-red disabled:cursor-wait disabled:text-ink-3"
                    aria-label={`${active && playback.state === "playing" ? "Pause" : "Play"} ${driver?.acronym ?? number} radio`}
                  >
                    {active && playback.state === "loading" ? "…" : active && playback.state === "playing" ? "Ⅱ" : "▶"}
                  </button>
                  <button type="button" onClick={() => player.seek(clip.t)} className="font-mono text-[10px] tabular-nums text-red hover:underline">
                    {fmtClock(clip.t)}
                  </button>
                  <span className="font-mono text-[11px] font-bold">{driver?.acronym ?? `#${number}`}</span>
                  <span className="truncate text-[10px] text-ink-3">{driver?.team}</span>
                  <span className="ml-auto font-mono text-[8px] tracking-[0.12em] text-ink-3">
                    {active ? playback.state.toUpperCase() : "READY"}
                  </span>
                </div>
                {active && playback.message && (
                  <div className="mt-2 border-l-2 border-ochre pl-2 font-mono text-[9px] leading-4 text-ochre">
                    {playback.message}
                  </div>
                )}
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}
