/**
 * Split-text line reveals + section-scoped ScrollTriggers.
 * Lines are split by measuring word wrap (no SplitText plugin dependency).
 */
import { gsap, ScrollTrigger } from '../core/scroll';
import { $$ } from '../utils/dom';

function splitLines(elm: HTMLElement) {
  const text = elm.textContent ?? '';
  elm.textContent = '';
  const words = text.split(/\s+/).filter(Boolean).map((w) => {
    const s = document.createElement('span');
    s.textContent = w + ' ';
    s.style.display = 'inline-block';
    elm.append(s);
    return s;
  });
  // group by offsetTop
  const lines: HTMLSpanElement[][] = [];
  let lastTop = -1;
  for (const w of words) {
    if (w.offsetTop !== lastTop) { lines.push([]); lastTop = w.offsetTop; }
    lines[lines.length - 1].push(w);
  }
  elm.textContent = '';
  for (const ws of lines) {
    const l = document.createElement('span');
    l.className = 'line';
    l.textContent = ws.map((w) => w.textContent).join('').trim();
    elm.append(l);
  }
  elm.setAttribute('aria-label', text);
}

export function initReveals(sectionHooks: { onEnter?: (i: number) => void } = {}) {
  $$('.reveal-lines').forEach(splitLines);
  document.querySelectorAll<HTMLElement>('.section').forEach((sec, i) => {
    const targets = [...sec.querySelectorAll<HTMLElement>('.reveal, .reveal-lines .line')];
    gsap.set(targets, { opacity: 0, y: '1.2em' });
    ScrollTrigger.create({
      trigger: sec,
      start: 'top 70%',
      onEnter: () => {
        gsap.to(targets, { opacity: 1, y: 0, duration: 1.3, ease: 'power3.out', stagger: 0.08, overwrite: true });
        sectionHooks.onEnter?.(i);
      },
      onLeaveBack: () => gsap.to(targets, { opacity: 0, y: '0.6em', duration: 0.5, ease: 'power2.in', overwrite: true }),
    });
    // Sticky content fades out over the last part of its track so two sections never share the screen.
    const inner = sec.querySelector<HTMLElement>('.section__inner');
    if (inner && i < 4) {
      gsap.fromTo(inner, { opacity: 1 }, {
        opacity: 0, ease: 'none', immediateRender: false,
        scrollTrigger: { trigger: sec, start: 'bottom 135%', end: 'bottom 100%', scrub: true },
      });
    }
  });
}

/** Hero plays as soon as the preloader finishes, independent of scroll. */
export function playHero() {
  const hero = document.querySelector<HTMLElement>('#hero')!;
  const targets = [...hero.querySelectorAll<HTMLElement>('.reveal, .reveal-lines .line')];
  gsap.to(targets, { opacity: 1, y: 0, duration: 1.6, ease: 'power3.out', stagger: 0.12, delay: 0.5, overwrite: true });
}
