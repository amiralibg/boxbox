import type { RaceControlEvent, ReplayBlob } from "@/lib/replay/types";

/**
 * Events derived client-side from the baked blob. Deliberately NOT baked —
 * these are heuristics (overtake filtering, status folding) that we want to
 * tune without invalidating every cached session on disk.
 */

export type TrackStatus = "green" | "yellow" | "sc" | "vsc" | "red" | "chequered";

export interface StatusSpan {
  t: number;
  status: TrackStatus;
}

/**
 * Fold race-control messages into a track-wide status timeline. Sector-scope
 * yellows count as "yellow" too — the track canvas only tints, it doesn't
 * localize. SC/VSC deployment ends on the green flag / ENDING message.
 */
export function deriveTrackStatus(rc: RaceControlEvent[]): StatusSpan[] {
  const spans: StatusSpan[] = [{ t: 0, status: "green" }];
  const push = (t: number, status: TrackStatus) => {
    const last = spans[spans.length - 1];
    if (last.status === status) return;
    if (last.t === t) spans[spans.length - 1] = { t, status };
    else spans.push({ t, status });
  };
  let yellows = 0; // open sector/track yellows (CLEAR closes them)

  for (const e of rc) {
    const msg = e.msg.toUpperCase();
    if (e.category === "SafetyCar") {
      if (msg.includes("VIRTUAL")) {
        // VSC DEPLOYED / VSC ENDING
        push(e.t, msg.includes("END") ? "green" : "vsc");
      } else {
        // SAFETY CAR DEPLOYED / IN THIS LAP
        if (msg.includes("IN THIS LAP") || msg.includes("ENDING")) push(e.t, "green");
        else if (msg.includes("DEPLOYED")) push(e.t, "sc");
      }
      continue;
    }
    if (e.category !== "Flag") continue;
    switch (e.flag) {
      case "RED":
        yellows = 0;
        push(e.t, "red");
        break;
      case "YELLOW":
      case "DOUBLE YELLOW":
        yellows++;
        // don't downgrade SC/VSC/red to a plain yellow
        if (spans[spans.length - 1].status === "green") push(e.t, "yellow");
        break;
      case "CLEAR":
        yellows = Math.max(0, yellows - 1);
        if (yellows === 0 && spans[spans.length - 1].status === "yellow") push(e.t, "green");
        break;
      case "GREEN":
        yellows = 0;
        push(e.t, "green");
        break;
      case "CHEQUERED":
        push(e.t, "chequered");
        break;
    }
  }
  return spans;
}

/** track status at time t — binary search over the span starts */
export function statusAt(spans: StatusSpan[], t: number): TrackStatus {
  if (spans.length === 0 || t < spans[0].t) return "green";
  let lo = 0;
  let hi = spans.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (spans[mid].t <= t) lo = mid;
    else hi = mid;
  }
  return spans[hi].t <= t ? spans[hi].status : spans[lo].status;
}

export interface Overtake {
  t: number;
  /** the driver who gained the place */
  num: number;
  /** the driver who lost it */
  passed: number;
  /** position gained into */
  pos: number;
  /** true when either car pitted within ±30 s — a pit cycle, not an on-track pass */
  pitCycle: boolean;
}

/**
 * Position swaps from the order event list. Grid shuffles in the first two
 * minutes are skipped; swaps near either car's pit-lane window are tagged
 * pitCycle so the UI can label them "position change" instead of "overtake".
 */
export function deriveOvertakes(order: ReplayBlob["order"], pits: ReplayBlob["pits"]): Overtake[] {
  const pitTimes = new Map<number, number[]>();
  for (const [num, stops] of Object.entries(pits)) {
    pitTimes.set(
      Number(num),
      stops.map((s) => s.t),
    );
  }
  const nearPit = (num: number, t: number) => (pitTimes.get(num) ?? []).some((pt) => Math.abs(pt - t) <= 30);

  const posOf = new Map<number, number>(); // driver → position
  const holder = new Map<number, number>(); // position → driver
  const out: Overtake[] = [];

  for (const e of order) {
    const prevPos = posOf.get(e.num);
    if (prevPos === e.pos) continue;
    const displaced = holder.get(e.pos);
    // a gain of exactly one place over a known car reads as a pass
    if (e.t > 120 && displaced != null && displaced !== e.num && prevPos != null && e.pos === prevPos - 1) {
      out.push({
        t: e.t,
        num: e.num,
        passed: displaced,
        pos: e.pos,
        pitCycle: nearPit(e.num, e.t) || nearPit(displaced, e.t),
      });
    }
    if (prevPos != null && holder.get(prevPos) === e.num) holder.delete(prevPos);
    posOf.set(e.num, e.pos);
    holder.set(e.pos, e.num);
  }
  return out;
}

/**
 * Earliest lap-start time per lap number across the field (index = lap,
 * NaN where nobody has a timestamp). Maps the lap axis of charts back to
 * session time for seeking and playheads.
 */
export function lapStartTimes(laps: ReplayBlob["laps"]): number[] {
  const out: number[] = [];
  for (const arr of Object.values(laps)) {
    for (const l of arr) {
      if (l.tStart == null) continue;
      if (out[l.lap] == null || l.tStart < out[l.lap]) out[l.lap] = l.tStart;
    }
  }
  for (let i = 0; i < out.length; i++) if (out[i] == null) out[i] = NaN;
  return out;
}

/** fractional lap number at session time t (for chart playheads) */
export function lapAtTime(starts: number[], t: number): number | null {
  let prev: number | null = null;
  let prevT = NaN;
  for (let lap = 1; lap < starts.length; lap++) {
    if (Number.isNaN(starts[lap])) continue;
    if (starts[lap] > t) {
      if (prev == null) return null;
      return prev + (t - prevT) / (starts[lap] - prevT);
    }
    prev = lap;
    prevT = starts[lap];
  }
  return prev;
}

export interface FastestLapEvent {
  /** session time the lap was completed (start + lap time) */
  t: number;
  num: number;
  lap: number;
  time: number;
}

/** progression of the session-best lap, in completion order */
export function deriveFastestLaps(laps: ReplayBlob["laps"]): FastestLapEvent[] {
  const done: FastestLapEvent[] = [];
  for (const [num, arr] of Object.entries(laps)) {
    for (const l of arr) {
      if (l.time == null || l.tStart == null) continue;
      done.push({ t: Math.round((l.tStart + l.time) * 10) / 10, num: Number(num), lap: l.lap, time: l.time });
    }
  }
  done.sort((a, b) => a.t - b.t);
  const out: FastestLapEvent[] = [];
  let best = Infinity;
  for (const e of done) {
    if (e.time < best) {
      best = e.time;
      out.push(e);
    }
  }
  return out;
}
