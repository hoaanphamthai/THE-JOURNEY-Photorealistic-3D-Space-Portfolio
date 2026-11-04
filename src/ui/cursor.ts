/**
 * Custom cursor (dot + trailing ring) with label morph on [data-cursor] elements,
 * plus magnetic hover for [data-magnetic]. Disabled on touch / reduced motion.
 */
import { gsap } from '../core/scroll';
import { $, $$, isTouch, prefersReducedMotion } from '../utils/dom';

export function initCursor() {
  if (isTouch() || prefersReducedMotion()) return;
  document.body.classList.add('has-cursor');
  const root = $('#cursor');
  const dot = $('.cursor__dot', root);
  const ring = $('.cursor__ring', root);
  const label = $('.cursor__label', root);
  const pos = { x: innerWidth / 2, y: innerHeight / 2 };
  const ringPos = { ...pos };

  const setDot = gsap.quickSetter(dot, 'x', 'px'), setDotY = gsap.quickSetter(dot, 'y', 'px');
  const setRing = gsap.quickSetter(ring, 'x', 'px'), setRingY = gsap.quickSetter(ring, 'y', 'px');
  const setLbl = gsap.quickSetter(label, 'x', 'px'), setLblY = gsap.quickSetter(label, 'y', 'px');

  window.addEventListener('pointermove', (e) => { pos.x = e.clientX; pos.y = e.clientY; }, { passive: true });
  gsap.ticker.add((_t, dtMs) => {
    const k = 1 - Math.exp(-(dtMs / 1000) * 18);
    ringPos.x += (pos.x - ringPos.x) * k; ringPos.y += (pos.y - ringPos.y) * k;
    setDot(pos.x); setDotY(pos.y);
    setRing(ringPos.x); setRingY(ringPos.y); setLbl(ringPos.x); setLblY(ringPos.y);
  });

  // hover state via delegation
  document.addEventListener('pointerover', (e) => {
    const t = (e.target as Element).closest('a, button, [data-cursor], [tabindex]');
    root.classList.toggle('is-hover', !!t);
    const l = t?.getAttribute('data-cursor');
    root.classList.toggle('is-label', !!l);
    if (l) label.textContent = l;
  });

  /** External hook: 3D panels report hover themselves. */
  return {
    setLabel(text: string | null) {
      root.classList.toggle('is-label', !!text);
      root.classList.toggle('is-hover', !!text);
      if (text) label.textContent = text;
    },
  };
}

export function initMagnetic() {
  if (isTouch() || prefersReducedMotion()) return;
  for (const elm of $$('[data-magnetic]')) {
    const xTo = gsap.quickTo(elm, 'x', { duration: 0.6, ease: 'power3.out' });
    const yTo = gsap.quickTo(elm, 'y', { duration: 0.6, ease: 'power3.out' });
    elm.addEventListener('pointermove', (e) => {
      const r = elm.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * 0.28);
      yTo((e.clientY - (r.top + r.height / 2)) * 0.28);
    });
    elm.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
  }
}

/** HUD panels tilt a few degrees toward the cursor. */
export function initTilt() {
  if (isTouch() || prefersReducedMotion()) return;
  for (const elm of $$('[data-tilt]')) {
    const rx = gsap.quickTo(elm, 'rotationX', { duration: 0.8, ease: 'power3.out' });
    const ry = gsap.quickTo(elm, 'rotationY', { duration: 0.8, ease: 'power3.out' });
    gsap.set(elm, { transformPerspective: 900 });
    elm.addEventListener('pointermove', (e) => {
      const r = elm.getBoundingClientRect();
      ry(((e.clientX - r.left) / r.width - 0.5) * 6);
      rx(-((e.clientY - r.top) / r.height - 0.5) * 6);
    });
    elm.addEventListener('pointerleave', () => { rx(0); ry(0); });
  }
}
