/**
 * World: owns the scene graph and all celestial bodies, drives per-frame updates,
 * lazy loading by camera distance, section-dependent post settings, and 3D interactions
 * (project panel raycast, skill labels).
 */
import { Raycaster, Vector2, Vector3, type PerspectiveCamera, type Scene, type WebGLRenderer, PCFShadowMap } from 'three';
import { Sky } from './scenes/sky';
import { Sun } from './scenes/sun';
import { Earth } from './scenes/earth';
import { Moon } from './scenes/moon';
import { Station, type PanelRef } from './scenes/station';
import { Saturn } from './scenes/saturn';
import type { Assets } from './core/assets';
import type { CameraRig } from './core/cameraRig';
import type { Post } from './core/post';
import { STATION_POS, EARTH_POS, EARTH_RADIUS, MOON_POS, MOON_RADIUS, SATURN_POS, SATURN_RADIUS, sectionIndexAt } from './config/universe';
import { content } from './config/content';
import { smoothstep } from './utils/math';
import { $$ } from './utils/dom';

const _v = new Vector3();
const _d = new Vector3();
const _p = new Vector3();
const _ndc = new Vector2();

export class World {
  sky = new Sky();
  sun = new Sun();
  earth = new Earth();
  moon = new Moon();
  station = new Station();
  saturn = new Saturn();
  private ray = new Raycaster();
  private pointer = new Vector2(2, 2); // offscreen until the first move
  hoveredPanel: PanelRef | null = null;
  private skillLabels: HTMLElement[] = [];
  private skillItems: HTMLElement[] = [];
  private section = -1;
  onPanelHover: ((p: PanelRef | null) => void) | null = null;

  constructor(scene: Scene, private camera: PerspectiveCamera, renderer: WebGLRenderer, private assets: Assets) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFShadowMap;
    scene.add(this.sky.group, this.earth.group, this.moon.group, this.station.group, this.saturn.group);
    this.sun.attach(scene);
    this.sun.focusShadow(STATION_POS);
    this.sun.flare.addOccluder(EARTH_POS, EARTH_RADIUS, () => this.earth.group.visible);
    this.sun.flare.addOccluder(MOON_POS, MOON_RADIUS, () => this.moon.group.visible);
    this.sun.flare.addOccluder(SATURN_POS, SATURN_RADIUS, () => this.saturn.group.visible);
    this.ray.params.Points = { threshold: 0 };
    this.ray.layers.enableAll();
    this.skillLabels = $$('[data-skill-label]');
    this.skillItems = $$('[data-skill]');
  }

  /** Critical path: stars + Milky Way + Earth. Everything else streams by proximity. */
  async loadCritical(report: (name: string, w: number) => (p: number) => void) {
    await Promise.all([
      this.sky.load(this.assets, report('stars', 2), report('milkyway', 1)),
      this.earth.load(this.assets, report('earth', 5)),
    ]);
  }

  setPointer(x: number, y: number) {
    this.pointer.set(x, y);
  }

  /** Approach-based streaming: start loading when the camera gets within range, preload the next body. */
  private stream(progress: number) {
    const s = sectionIndexAt(progress);
    if (s >= 0 && !this.moon.loaded) this.moon.load(this.assets);
    if (s >= 1 && !this.station.loaded) this.station.load(this.assets);
    if (s >= 2 && !this.saturn.loaded) this.saturn.load(this.assets);
  }

  update(dt: number, elapsed: number, rig: CameraRig, post: Post) {
    const cam = this.camera;
    this.stream(rig.progress);
    this.sky.update(cam.position);
    this.sun.update(cam, elapsed, dt);
    this.earth.update(dt, cam);
    this.moon.update(cam);
    this.station.update(dt, elapsed);
    this.saturn.update(dt, cam);

    // Visibility culling by section: far bodies are tiny or behind us; skipping them saves draw calls.
    const p = rig.progress;
    this.saturn.group.visible = p > 0.55;
    this.station.group.visible = p > 0.3 && p < 0.72;
    this.moon.group.visible = p < 0.72;
    this.earth.group.visible = p < 0.72;

    // Depth of field only for close shots (Moon flyby and station)
    const dMoon = this.moon.distanceTo(cam.position);
    const dStation = this.station.distanceTo(cam.position);
    const dofMoon = 1 - smoothstep(0.3, 1.2, dMoon);
    const dofStation = 1 - smoothstep(0.3, 1.0, dStation);
    const dof = Math.max(dofMoon, dofStation) * 0.6;
    post.setDof(dof, dofStation > dofMoon ? 0.0004 : 0.0012);

    this.updatePanels();
    this.updateSkillLabels(p);

    const s = sectionIndexAt(p);
    if (s !== this.section) this.section = s;
  }

  private updatePanels() {
    if (!this.station.group.visible) { this.setHover(null); return; }
    this.ray.setFromCamera(this.pointer, this.camera);
    const hits = this.ray.intersectObjects(this.station.panels.map((p) => p.mesh), false);
    const hit = hits[0];
    const ref = hit ? this.station.panels[hit.object.userData.panelIndex as number] : null;
    if (ref && hit?.uv) ref.mat.uniforms.uMouse.value = { x: hit.uv.x, y: hit.uv.y };
    this.setHover(ref);
  }

  private setHover(ref: PanelRef | null) {
    if (ref === this.hoveredPanel) return;
    if (this.hoveredPanel) this.hoveredPanel.hover = 0;
    this.hoveredPanel = ref;
    if (ref) ref.hover = 1;
    this.onPanelHover?.(ref);
  }

  private updateSkillLabels(progress: number) {
    const inSaturn = progress > 0.62 && progress < 0.9;
    const hl = this.saturn.highlight;
    for (let i = 0; i < this.skillLabels.length; i++) {
      const l = this.skillLabels[i];
      if (!inSaturn) { l.classList.remove('is-visible'); continue; }
      this.saturn.skillWorld(i, _v);
      // hide labels whose moonlet is behind the planet
      _d.subVectors(_v, this.camera.position);
      const len = _d.length();
      _d.divideScalar(len);
      _p.subVectors(SATURN_POS, this.camera.position);
      const b = _p.dot(_d);
      const behind = b > 0 && b < len && _p.lengthSq() - b * b < SATURN_RADIUS * SATURN_RADIUS;
      _v.project(this.camera);
      const visible = !behind && _v.z < 1 && Math.abs(_v.x) < 0.95 && Math.abs(_v.y) < 0.92;
      l.classList.toggle('is-visible', visible);
      if (!visible) continue;
      _ndc.set((_v.x * 0.5 + 0.5) * innerWidth, (-_v.y * 0.5 + 0.5) * innerHeight);
      l.style.transform = `translate3d(${_ndc.x.toFixed(1)}px, ${_ndc.y.toFixed(1)}px, 0) translate(-50%, -50%)`;
      l.classList.toggle('is-hot', hl === i);
      l.classList.toggle('is-dim', hl >= 0 && hl !== i);
    }
  }

  setSkillHighlight(i: number) {
    this.saturn.highlight = i;
    this.skillItems.forEach((e, j) => e.classList.toggle('is-hot', j === i));
    this.skillItems[0]?.parentElement?.classList.toggle('has-hot', i >= 0);
  }

  get projectCount() { return content.projects.length; }

  dispose() {
    this.sky.dispose(); this.sun.dispose(); this.earth.dispose(); this.moon.dispose();
    this.station.dispose(); this.saturn.dispose();
  }
}
