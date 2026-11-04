/** Cinematic preloader with real progress and rotating system messages. */
import { $ } from '../utils/dom';

const MESSAGES = [
  'Initializing navigation systems',
  'Loading star catalogue',
  'Calibrating optics',
  'Acquiring Earth imagery',
  'Aligning with galactic plane',
  'Pressurising cabin',
];

export class Preloader {
  private root = $('#preloader');
  private label = $('#preloader-label');
  private pct = $('#preloader-pct');
  private fill = $('#preloader-fill');
  private shown = 0; // displayed value eases towards real progress
  private real = 0;
  private raf = 0;
  private done = false;

  constructor() {
    const tick = () => {
      this.shown += (this.real - this.shown) * 0.12;
      const v = Math.round(this.shown);
      this.pct.textContent = `${v}%`;
      this.fill.style.transform = `scaleX(${this.shown / 100})`;
      this.label.textContent = `${MESSAGES[Math.min(MESSAGES.length - 1, Math.floor((v / 100) * MESSAGES.length))]}… ${v}%`;
      if (!this.done) this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  set(p: number) {
    this.real = Math.max(this.real, Math.min(100, p * 100));
  }

  async finish() {
    this.real = 100;
    await new Promise((r) => setTimeout(r, 450));
    this.done = true;
    cancelAnimationFrame(this.raf);
    this.pct.textContent = '100%';
    this.fill.style.transform = 'scaleX(1)';
    this.root.classList.add('is-done');
    this.root.setAttribute('aria-hidden', 'true');
  }
}
