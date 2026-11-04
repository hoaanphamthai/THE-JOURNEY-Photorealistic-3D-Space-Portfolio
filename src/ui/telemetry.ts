/** Telemetry readout + progress bar + section counter + active nav. All transform/text only. */
import { TELEMETRY, SECTIONS, sectionIndexAt } from '../config/universe';
import { $, $$ } from '../utils/dom';

const fmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export class Telemetry {
  private dist = $('#tele-dist');
  private vel = $('#tele-vel');
  private loc = $('#tele-loc');
  private counter = $('#section-counter');
  private fill = $('#progress-fill');
  private nav = $$('.hud__nav a');
  private lastSection = -1;
  private lastKm = 0;
  private shownVel = 7.66;

  update(t: number, dt: number) {
    // log-space interpolation between anchors so the jump to Saturn reads smoothly
    let a = TELEMETRY[0], b = TELEMETRY[TELEMETRY.length - 1];
    for (let i = 0; i < TELEMETRY.length - 1; i++) if (t >= TELEMETRY[i].t && t <= TELEMETRY[i + 1].t) { a = TELEMETRY[i]; b = TELEMETRY[i + 1]; break; }
    const u = (t - a.t) / Math.max(1e-6, b.t - a.t);
    const km = Math.exp(Math.log(a.km) + (Math.log(b.km) - Math.log(a.km)) * u);
    this.dist.textContent = km > 1e8 ? `${(km / 1e6).toFixed(1)} M km` : `${fmt.format(km)} km`;
    // Displayed "velocity": orbital speed floor + damped rate of distance change (compressed to a readable range)
    const rate = dt > 0 && this.lastKm > 0 ? Math.abs(km - this.lastKm) / dt : 0; // km per second of real time
    const target = Math.min(7.66 + Math.log10(1 + rate) * 6, 300);
    this.shownVel += (target - this.shownVel) * Math.min(1, dt * 3);
    this.vel.textContent = `${this.shownVel.toFixed(2)} km/s`;
    this.lastKm = km;
    this.fill.style.transform = `scaleX(${t})`;
    const s = sectionIndexAt(t);
    if (s !== this.lastSection) {
      this.lastSection = s;
      this.counter.textContent = `${String(s + 1).padStart(2, '0')} / ${String(SECTIONS.length).padStart(2, '0')}`;
      this.loc.textContent = SECTIONS[s].label;
      this.nav.forEach((n, i) => n.classList.toggle('is-active', i === s));
    }
  }
}
