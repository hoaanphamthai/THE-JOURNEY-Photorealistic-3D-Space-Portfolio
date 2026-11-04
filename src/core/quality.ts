/**
 * Adaptive quality manager.
 * Watches a rolling average of frame time; steps the quality tier DOWN after
 * ~1.5 s of sustained slowness and back UP after ~6 s of headroom.
 *
 * Tiers (3 = best):
 *   3: DPR ≤ 2,   bloom + SMAA + grain + CA, 4K-class textures, stars ×1
 *   2: DPR ≤ 1.5, bloom + SMAA + grain,        stars ×1
 *   1: DPR ≤ 1.0, bloom only,                  stars ×0.8
 *   0: DPR ≤ 0.75, no post,                    stars ×0.6
 */
import { isMobile, prefersReducedMotion } from '../utils/dom';

export interface QualityTier {
  level: 0 | 1 | 2 | 3;
  dpr: number;
  post: boolean;
  bloom: boolean;
  smaa: boolean;
  grain: boolean;
  chromatic: boolean;
  starScale: number;
  textureSize: 2048 | 4096;
}

const TIERS: QualityTier[] = [
  { level: 0, dpr: 0.75, post: false, bloom: false, smaa: false, grain: false, chromatic: false, starScale: 0.6, textureSize: 2048 },
  { level: 1, dpr: 1.0, post: true, bloom: true, smaa: false, grain: false, chromatic: false, starScale: 0.8, textureSize: 2048 },
  { level: 2, dpr: 1.5, post: true, bloom: true, smaa: true, grain: true, chromatic: false, starScale: 1, textureSize: 2048 },
  { level: 3, dpr: 2.0, post: true, bloom: true, smaa: true, grain: true, chromatic: true, starScale: 1, textureSize: 4096 },
];

export class QualityManager {
  tier: QualityTier;
  private maxLevel: number;
  private listeners: ((t: QualityTier) => void)[] = [];
  private avg = 16.6;
  private slowFor = 0;
  private fastFor = 0;
  locked = false; // debug GUI can pin a tier
  fps = 60;

  constructor() {
    this.maxLevel = isMobile() ? 1 : 3;
    if (prefersReducedMotion()) this.maxLevel = Math.min(this.maxLevel, 1);
    this.tier = TIERS[this.maxLevel];
  }

  onChange(fn: (t: QualityTier) => void) {
    this.listeners.push(fn);
    fn(this.tier);
  }

  set(level: number) {
    const l = Math.max(0, Math.min(this.maxLevel, level)) as 0 | 1 | 2 | 3;
    if (l === this.tier.level) return;
    this.tier = TIERS[l];
    this.listeners.forEach((f) => f(this.tier));
  }

  /** Call once per frame with dt in seconds. */
  update(dt: number) {
    const ms = dt * 1000;
    this.avg += (ms - this.avg) * 0.08;
    this.fps = 1000 / this.avg;
    if (this.locked) return;
    const budget = isMobile() ? 33.3 : 16.7;
    if (this.avg > budget * 1.35) {
      this.slowFor += dt;
      this.fastFor = 0;
      if (this.slowFor > 1.5) {
        this.set(this.tier.level - 1);
        this.slowFor = 0;
      }
    } else if (this.avg < budget * 0.8) {
      this.fastFor += dt;
      this.slowFor = 0;
      if (this.fastFor > 6) {
        this.set(this.tier.level + 1);
        this.fastFor = 0;
      }
    } else {
      this.slowFor = Math.max(0, this.slowFor - dt);
    }
  }
}
