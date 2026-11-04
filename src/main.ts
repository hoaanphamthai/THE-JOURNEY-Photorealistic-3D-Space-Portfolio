/**
 * Entry point. Boot order:
 *  1. hydrate DOM from content.ts (works even without WebGL / in ?simple mode)
 *  2. renderer + loop + scroll + post + quality manager
 *  3. critical assets with real progress → preloader → hero reveal
 *  4. interactions (cursor, magnetic, tilt, panels, skills, overlay, telemetry, audio, debug)
 */
import { Vector3 } from 'three';
import { createRenderer, createCamera, createScene } from './core/renderer';
import { Loop, bindVisibility } from './core/loop';
import { QualityManager } from './core/quality';
import { Assets, Progress } from './core/assets';
import { CameraRig } from './core/cameraRig';
import { Scroll, gsap, ScrollTrigger } from './core/scroll';
import { Post } from './core/post';
import { World } from './world';
import { hydrate } from './ui/hydrate';
import { Preloader } from './ui/preloader';
import { initCursor, initMagnetic, initTilt } from './ui/cursor';
import { initReveals, playHero } from './ui/reveal';
import { Overlay } from './ui/overlay';
import { Telemetry } from './ui/telemetry';
import { Ambience } from './ui/audio';
import { content } from './config/content';
import { $, $$, hasWebGL2, prefersReducedMotion } from './utils/dom';

hydrate();

const simple = new URLSearchParams(location.search).has('simple');
const reduced = prefersReducedMotion();
if (reduced) document.documentElement.classList.add('reduced-motion');

if (simple || !hasWebGL2()) {
  // Graceful fallback: plain, readable page. Same content, no canvas.
  document.body.classList.add('simple', 'is-ready');
  document.documentElement.classList.add('no-gl');
  $('#preloader').remove();
  if (!simple) $('#nogl').hidden = false;
  $('#skip3d').textContent = 'Back to 3D view';
  ($('#skip3d') as HTMLAnchorElement).href = location.pathname;
  wireStaticInteractions();
} else {
  boot().catch((err) => {
    console.error(err);
    document.body.classList.add('simple', 'is-ready');
    $('#preloader').remove();
  });
}

function wireStaticInteractions() {
  const overlay = new Overlay(() => {});
  $$('[data-project-open]').forEach((b) => b.addEventListener('click', () => overlay.open(content.projects[Number(b.dataset.projectOpen)])));
  wireEmail();
}

function wireEmail(audio?: Ambience) {
  const btn = $('#copy-email');
  btn.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(content.email); } catch { /* clipboard blocked: the address is visible anyway */ }
    btn.classList.add('is-copied');
    audio?.tick();
    setTimeout(() => btn.classList.remove('is-copied'), 1400);
  });
}

async function boot() {
  const canvas = $<HTMLCanvasElement>('#gl');
  const renderer = createRenderer(canvas);
  const camera = createCamera();
  const scene = createScene();
  const assets = new Assets(renderer);
  const quality = new QualityManager();
  const loop = new Loop();
  const post = new Post(renderer, scene, camera);
  const rig = new CameraRig(camera);
  rig.reducedMotion = reduced;
  const world = new World(scene, camera, renderer, assets);
  const preloader = new Preloader();
  const telemetry = new Telemetry();
  const audio = new Ambience();

  // --- quality tier → renderer/post/sky ---
  quality.onChange((t) => {
    const dpr = Math.min(window.devicePixelRatio, t.dpr);
    renderer.setPixelRatio(dpr);
    post.applyTier(t);
    world.sky.setQuality(dpr, t.starScale);
    resize();
  });

  // --- resize (also orientation change) ---
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    post.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  let resizeT = 0;
  window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = window.setTimeout(() => { resize(); ScrollTrigger.refresh(); }, 120); });
  resize();

  // --- load critical assets with real progress ---
  const progress = new Progress((p) => preloader.set(p * 0.95));
  await world.loadCritical((name, w) => progress.track(name, w));
  // compile shaders before the fade-in so the first frame doesn't hitch
  await renderer.compileAsync(scene, camera);
  preloader.set(1);

  // --- scroll ---
  const scroll = new Scroll();
  scroll.onProgress((p) => (rig.target = p));
  rig.target = scroll.progress;
  rig.update(0, 0, true);

  // --- pointer parallax + panel raycast share one listener ---
  window.addEventListener('pointermove', (e) => {
    const x = (e.clientX / innerWidth) * 2 - 1, y = -(e.clientY / innerHeight) * 2 + 1;
    rig.mouse.x = x; rig.mouse.y = y;
    world.setPointer(x, y);
  }, { passive: true });

  // --- interactions ---
  const cursor = initCursor();
  initMagnetic();
  initTilt();
  initReveals();

  const overlay = new Overlay((lock) => (lock ? scroll.stop() : scroll.start()));
  const zoom = { w: 0 };
  let activePanel = -1;
  const openProject = (i: number) => {
    const ref = world.station.panels[i];
    if (!ref) return;
    activePanel = i;
    $$('.project').forEach((e, j) => e.classList.toggle('is-active', j === i));
    rig.override = { pos: ref.camPos, look: ref.camLook, weight: 0 };
    gsap.to(zoom, { w: 1, duration: 1.4, ease: 'expo.inOut', onUpdate: () => (rig.override!.weight = zoom.w), onComplete: () => overlay.open(ref.project) });
    audio.tick();
  };
  overlay.onClose = () => {
    activePanel = -1;
    $$('.project').forEach((e) => e.classList.remove('is-active'));
    gsap.to(zoom, { w: 0, duration: 1.2, ease: 'expo.inOut', onUpdate: () => { if (rig.override) rig.override.weight = zoom.w; }, onComplete: () => (rig.override = null) });
  };
  $$('[data-project-open]').forEach((b) => b.addEventListener('click', () => openProject(Number(b.dataset.projectOpen))));
  canvas.addEventListener('click', () => { if (world.hoveredPanel && activePanel < 0) openProject(world.station.panels.indexOf(world.hoveredPanel)); });
  world.onPanelHover = (p) => cursor?.setLabel(p ? 'View' : null);

  // skills: DOM list hover ↔ 3D moonlets
  $$('[data-skill]').forEach((li) => {
    const i = Number(li.dataset.skill);
    li.addEventListener('pointerenter', () => world.setSkillHighlight(i));
    li.addEventListener('focus', () => world.setSkillHighlight(i));
    li.addEventListener('pointerleave', () => world.setSkillHighlight(-1));
    li.addEventListener('blur', () => world.setSkillHighlight(-1));
  });

  wireEmail(audio);
  const audioBtn = $('#audio-toggle');
  audioBtn.textContent = content.ui.audioOff;
  audioBtn.addEventListener('click', () => {
    const on = audio.toggle();
    audioBtn.setAttribute('aria-pressed', String(on));
    audioBtn.textContent = on ? content.ui.audioOn : content.ui.audioOff;
  });

  // nav links → Lenis
  $$('.hud__nav a, .hud__brand').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    scroll.scrollTo(a.getAttribute('href')!);
  }));

  // --- debug (lazy) ---
  let debug: { tick(): void } | null = null;
  if (import.meta.env.DEV || location.hash === '#debug') debug = await import('./ui/debug').then((m) => m.initDebug({ world, post, quality, rig, renderer }));

  // --- main loop ---
  const camPos = new Vector3();
  loop.add((dt, elapsed) => {
    quality.update(dt);
    rig.update(dt, elapsed);
    camPos.copy(camera.position);
    world.update(dt, elapsed, rig, post);
    telemetry.update(rig.progress, dt);
    post.render(dt);
    debug?.tick();
  });
  bindVisibility(loop);
  loop.start();
  if (import.meta.env.DEV) (window as unknown as { __app: unknown }).__app = { renderer, camera, scene, rig, world, post, quality, loop };

  // --- reveal ---
  await preloader.finish();
  document.body.classList.add('is-ready');
  playHero();

  // teardown on navigation (bfcache-safe)
  window.addEventListener('pagehide', () => { loop.stop(); world.dispose(); post.dispose(); assets.dispose(); renderer.dispose(); });
}
