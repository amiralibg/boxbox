/**
 * TelemetryPlayer: a rAF clock with play/pause/seek/speed and subscriber
 * callbacks. Deliberately not React state — subscribers (canvas, HUD, chart
 * playheads) read the clock imperatively at 60fps without re-rendering.
 */
export class TelemetryPlayer {
  private _t = 0;
  private _playing = false;
  private _speed = 1;
  private raf = 0;
  private lastStamp = 0;
  private subs = new Set<(t: number) => void>();

  constructor(public duration: number) {}

  get t() {
    return this._t;
  }
  get playing() {
    return this._playing;
  }
  get speed() {
    return this._speed;
  }

  subscribe(cb: (t: number) => void): () => void {
    this.subs.add(cb);
    cb(this._t);
    return () => this.subs.delete(cb);
  }

  private emit() {
    for (const cb of this.subs) cb(this._t);
  }

  private tick = (stamp: number) => {
    if (!this._playing) return;
    const dt = (stamp - this.lastStamp) / 1000;
    this.lastStamp = stamp;
    this._t += dt * this._speed;
    if (this._t >= this.duration) this._t = 0; // loop
    this.emit();
    this.raf = requestAnimationFrame(this.tick);
  };

  play() {
    if (this._playing) return;
    this._playing = true;
    this.lastStamp = performance.now();
    this.raf = requestAnimationFrame(this.tick);
    this.emit();
  }

  pause() {
    this._playing = false;
    cancelAnimationFrame(this.raf);
    this.emit();
  }

  toggle() {
    this._playing ? this.pause() : this.play();
  }

  seek(t: number) {
    this._t = Math.max(0, Math.min(t, this.duration));
    this.emit();
  }

  setSpeed(s: number) {
    this._speed = s;
  }

  destroy() {
    this.pause();
    this.subs.clear();
  }
}
