/** lil-gui debug panel, toggled with "D". Lazy-loaded so it never ships in the critical path. */
import type { World } from '../world';
import type { Post } from '../core/post';
import type { QualityManager } from '../core/quality';
import type { CameraRig } from '../core/cameraRig';
import type { WebGLRenderer } from 'three';

export async function initDebug(ctx: { world: World; post: Post; quality: QualityManager; rig: CameraRig; renderer: WebGLRenderer }) {
  const { default: GUI } = await import('lil-gui');
  const gui = new GUI({ title: 'Debug (D)', width: 300 });
  gui.hide();
  const state = { fps: 0, tier: ctx.quality.tier.level, progress: 0, lockTier: false };

  const q = gui.addFolder('Quality');
  q.add(state, 'fps').listen().disable();
  q.add(state, 'tier', 0, 3, 1).onChange((v: number) => { ctx.quality.locked = true; ctx.quality.set(v); });
  q.add(state, 'lockTier').onChange((v: boolean) => (ctx.quality.locked = v));

  const r = gui.addFolder('Render');
  r.add(ctx.renderer, 'toneMappingExposure', 0.2, 3, 0.01);
  r.add(ctx.post.bloom, 'intensity', 0, 2, 0.01).name('bloom');
  r.add(ctx.post.bloom.luminanceMaterial, 'threshold', 0.5, 3, 0.01).name('bloom threshold');
  r.add(ctx.post.noise.blendMode.opacity, 'value', 0, 1, 0.01).name('grain');
  r.add(ctx.post.vignette, 'darkness', 0, 1, 0.01);

  const c = gui.addFolder('Camera');
  c.add(state, 'progress', 0, 1, 0.001).onChange((v: number) => { ctx.rig.target = v; ctx.rig.progress = v; });
  c.add(ctx.rig.camera, 'fov', 20, 80, 0.5).onChange(() => ctx.rig.camera.updateProjectionMatrix());

  const b = gui.addFolder('Bodies');
  b.add(ctx.world.earth.group, 'visible').name('earth');
  b.add(ctx.world.moon.group, 'visible').name('moon');
  b.add(ctx.world.station.group, 'visible').name('station');
  b.add(ctx.world.saturn.group, 'visible').name('saturn');

  let shown = false;
  window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'd' && !e.metaKey && !e.ctrlKey && !(e.target instanceof HTMLInputElement)) {
      shown = !shown;
      shown ? gui.show() : gui.hide();
    }
  });
  return {
    tick() { state.fps = Math.round(ctx.quality.fps); state.tier = ctx.quality.tier.level; },
  };
}
