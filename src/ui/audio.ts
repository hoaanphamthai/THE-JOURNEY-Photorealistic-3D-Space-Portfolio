/**
 * Optional audio: OFF by default. Pure Web Audio synthesis (no files): low ambient drone,
 * muffled cabin hum, soft UI tick. No whooshes — there is no sound in vacuum.
 */
export class Ambience {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  enabled = false;

  toggle() {
    this.enabled ? this.stop() : this.start();
    return this.enabled;
  }

  private start() {
    const ctx = (this.ctx ??= new AudioContext());
    ctx.resume();
    const master = (this.master = ctx.createGain());
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0.35, ctx.currentTime + 3);
    master.connect(ctx.destination);

    // drone: two detuned sines through a lowpass
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180; lp.connect(master);
    for (const [f, g] of [[55, 0.5], [55.7, 0.35], [110, 0.12]] as const) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const gn = ctx.createGain(); gn.gain.value = g; o.connect(gn).connect(lp); o.start();
    }
    // cabin hum: filtered noise
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.3;
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 120; bp.Q.value = 0.6;
    const ng = ctx.createGain(); ng.gain.value = 0.18;
    src.connect(bp).connect(ng).connect(master); src.start();
    this.enabled = true;
  }

  private stop() {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(0, t + 1.2);
    const m = this.master;
    setTimeout(() => m.disconnect(), 1300);
    this.enabled = false;
  }

  tick() {
    if (!this.enabled || !this.ctx || !this.master) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(1400, t); o.frequency.exponentialRampToValueAtTime(900, t + 0.05);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.08, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + 0.1);
  }
}
