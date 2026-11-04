/**
 * Lenis smooth scroll synced with GSAP's ticker (one clock) + ScrollTrigger.
 * Exposes a normalised 0..1 progress for the camera rig.
 */
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { prefersReducedMotion } from '../utils/dom';

gsap.registerPlugin(ScrollTrigger);

export class Scroll {
  lenis: Lenis | null = null;
  progress = 0;
  private listeners: ((p: number) => void)[] = [];

  constructor() {
    if (!prefersReducedMotion()) {
      this.lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9, touchMultiplier: 1.4, smoothWheel: true });
      this.lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((t) => this.lenis!.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    }
    const read = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      this.progress = max > 0 ? window.scrollY / max : 0;
      this.listeners.forEach((f) => f(this.progress));
    };
    window.addEventListener('scroll', read, { passive: true });
    window.addEventListener('resize', () => ScrollTrigger.refresh());
    read();
  }

  onProgress(fn: (p: number) => void) {
    this.listeners.push(fn);
  }

  scrollTo(target: string | number, opts: { immediate?: boolean } = {}) {
    if (this.lenis) this.lenis.scrollTo(target, { duration: 1.6, ...opts });
    else if (typeof target === 'number') window.scrollTo({ top: target, behavior: 'smooth' });
    else document.querySelector(target)?.scrollIntoView({ behavior: 'smooth' });
  }

  stop() { this.lenis?.stop(); }
  start() { this.lenis?.start(); }
}

export { gsap, ScrollTrigger };
