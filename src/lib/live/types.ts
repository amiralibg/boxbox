/**
 * Live-feed abstraction (spec Part 4). The replay viewer and live mode share
 * this frame shape — "live" is just frames arriving in real time.
 *
 * Implementations:
 *  - DelayedRestFeed (default, FREE): polls OpenF1 REST. Near-live during a
 *    session, works on historical data outside it. Shipped.
 *  - SignalRFeed (free, fragile, unofficial): livetiming.formula1.com. Later.
 *  - OpenF1StreamFeed (sponsor token, MQTT/WS): token exchange stays
 *    server-side; browser only ever sees our SSE endpoint. Later.
 */

export interface LiveCar {
  x: number;
  y: number;
}

export interface LiveFrame {
  /** seconds since session start */
  t: number;
  cars: Record<number, LiveCar>;
  /** present when the running order changed */
  order?: { num: number; pos: number }[];
  /** gap to leader in seconds, when fresh interval data exists */
  gaps?: Record<number, number | null>;
}

export interface LiveMeta {
  sessionKey: number;
  sessionName: string;
  circuitKey: number;
  dateStart: string;
  dateEnd: string;
  drivers: { num: number; acronym: string; team: string; colour: string | null }[];
}

export interface LiveFeed {
  /** resolves once session metadata is known */
  meta(): Promise<LiveMeta>;
  subscribe(onFrame: (frame: LiveFrame) => void, onEnd: () => void): () => void;
}
