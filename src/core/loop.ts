/**
 * Single requestAnimationFrame loop. Pauses when the tab is hidden.
 * dt is clamped so a background tab resuming never produces a giant step.
 */
export type Tick = (dt: number, elapsed: number) => void;

export class Loop {
  private ticks: Tick[] = [];
  private raf = 0;
  private last = 0;
  private elapsed = 0;
  running = false;

  add(t: Tick) {
    this.ticks.push(t);
    return () => (this.ticks = this.ticks.filter((x) => x !== t));
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const frame = (now: number) => {
      if (!this.running) return;
      const dt = Math.min((now - this.last) / 1000, 1 / 20);
      this.last = now;
      this.elapsed += dt;
      try {
        for (let i = 0; i < this.ticks.length; i++) this.ticks[i](dt, this.elapsed);
      } catch (err) {
        // Surface the error instead of silently stopping the animation loop.
        console.error('[loop]', err);
        this.running = false;
        return;
      }
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }
}

export function bindVisibility(loop: Loop) {
  document.addEventListener('visibilitychange', () => (document.hidden ? loop.stop() : loop.start()));
}
