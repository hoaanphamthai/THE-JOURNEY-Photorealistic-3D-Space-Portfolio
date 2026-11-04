/** Full-screen case-study overlay (DOM). Focus-trapped, Esc closes, returns focus. */
import { gsap } from '../core/scroll';
import type { Project } from '../config/content';
import { $, el } from '../utils/dom';

export class Overlay {
  private root = $('#overlay');
  private panel = $('.overlay__panel', this.root);
  private scrim = $('.overlay__scrim', this.root);
  private lastFocus: HTMLElement | null = null;
  onClose: (() => void) | null = null;
  isOpen = false;

  constructor(private lockScroll: (lock: boolean) => void) {
    this.root.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => this.close()));
    document.addEventListener('keydown', (e) => {
      if (!this.isOpen) return;
      if (e.key === 'Escape') this.close();
      if (e.key === 'Tab') this.trap(e);
    });
  }

  open(p: Project) {
    this.lastFocus = document.activeElement as HTMLElement;
    $('#overlay-meta').textContent = `${p.year} · ${p.category}`;
    $('#overlay-title').textContent = p.title;
    const img = $<HTMLImageElement>('#overlay-img');
    img.src = p.image; img.alt = `${p.title} — preview`;
    img.onerror = () => { img.removeAttribute('src'); img.alt = ''; };
    const body = $('#overlay-body'); body.textContent = '';
    p.description.forEach((d) => body.append(el('p', { text: d })));
    const stack = $('#overlay-stack'); stack.textContent = '';
    p.stack.forEach((s) => stack.append(el('li', { text: s })));
    const links = $('#overlay-links'); links.textContent = '';
    if (p.link) links.append(el('a', { href: p.link, target: '_blank', rel: 'noopener noreferrer', text: 'Visit site ↗' }));
    if (p.repo) links.append(el('a', { href: p.repo, target: '_blank', rel: 'noopener noreferrer', text: 'Source ↗' }));

    this.root.hidden = false;
    this.isOpen = true;
    this.lockScroll(true);
    gsap.fromTo(this.scrim, { opacity: 0 }, { opacity: 1, duration: 0.6, ease: 'power2.out' });
    gsap.fromTo(this.panel, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', delay: 0.1 });
    $<HTMLButtonElement>('.overlay__close', this.root).focus();
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    gsap.to(this.panel, { opacity: 0, y: 16, duration: 0.4, ease: 'power2.in' });
    gsap.to(this.scrim, { opacity: 0, duration: 0.5, ease: 'power2.in', onComplete: () => { this.root.hidden = true; } });
    this.lockScroll(false);
    this.lastFocus?.focus();
    this.onClose?.();
  }

  private trap(e: KeyboardEvent) {
    const f = [...this.root.querySelectorAll<HTMLElement>('button, a[href]')];
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
    else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
  }
}
