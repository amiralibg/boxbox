import { describe, expect, it } from "vitest";
import { deriveOvertakes, deriveTrackStatus, lapAtTime } from "./derive";
import { gapAt, lapGapAt, positionIsStale } from "./types";

describe("replay interpolation", () => {
  it("interpolates interval gaps instead of snapping", () => {
    expect(gapAt([0, 4], 1, 0.25)).toBe(1);
    expect(gapAt([null, 4], 1, 0.25)).toBe(4);
  });

  it("keeps structured lapped labels", () => {
    const events = [{ t: 10, label: "+1 LAP" }, { t: 20, label: "+2 LAPS" }];
    expect(lapGapAt(events, 15)).toBe("+1 LAP");
    expect(lapGapAt(events, 25)).toBe("+2 LAPS");
  });

  it("marks signal holes and expired channels stale", () => {
    const channel = { lastT: 100, missing: [[20, 30] as [number, number]] };
    expect(positionIsStale(channel, 25)).toBe(true);
    expect(positionIsStale(channel, 107)).toBe(true);
    expect(positionIsStale(channel, 50)).toBe(false);
  });
});

describe("replay derivations", () => {
  it("folds safety car and green messages", () => {
    const spans = deriveTrackStatus([
      { t: 10, category: "SafetyCar", flag: null, scope: "Track", sector: null, msg: "SAFETY CAR DEPLOYED", driver: null, lap: null },
      { t: 30, category: "Flag", flag: "GREEN", scope: "Track", sector: null, msg: "GREEN FLAG", driver: null, lap: null },
    ]);
    expect(spans.map((span) => span.status)).toEqual(["green", "sc", "green"]);
  });

  it("tags position changes around pit cycles", () => {
    const order = [
      { t: 0, num: 1, pos: 1 }, { t: 0, num: 2, pos: 2 },
      { t: 150, num: 2, pos: 1 },
    ];
    const passes = deriveOvertakes(order, { 1: [{ t: 145, lap: 10, durationS: 20 }] });
    expect(passes[0]).toMatchObject({ num: 2, passed: 1, pitCycle: true });
  });

  it("maps session time to fractional lap", () => {
    expect(lapAtTime([NaN, 10, 20], 15)).toBe(1.5);
  });
});
