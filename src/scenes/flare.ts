/**
 * Lens flare without readPixels: a handful of additive ghost sprites laid along the Sun→screen-centre
 * axis in camera space. Occlusion is analytic (ray vs. the big spheres), so no GPU stall.
 */
import {
  Group, Mesh, PlaneGeometry, MeshBasicMaterial, AdditiveBlending, CanvasTexture, Vector3, Color,
  type PerspectiveCamera,
} from 'three';
import { SUN_DIR } from '../config/universe';

const _sunNdc = new Vector3();
const _p = new Vector3();

function discTexture(size: number, hard: number, ring = false) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  if (ring) {
    grd.addColorStop(0, 'rgba(255,255,255,0)');
    grd.addColorStop(0.78, 'rgba(255,255,255,0)');
    grd.addColorStop(0.86, 'rgba(255,255,255,0.55)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
  } else {
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(hard, 'rgba(255,255,255,0.55)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
  }
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  return new CanvasTexture(c);
}

interface Occluder { center: Vector3; radius: number; visible: () => boolean }

export class Flare {
  group = new Group();
  private ghosts: { mesh: Mesh; mat: MeshBasicMaterial; t: number; size: number; alpha: number }[] = [];
  private occluders: Occluder[] = [];
  private fade = 0;
  intensity = 1;

  constructor() {
    const soft = discTexture(128, 0.15);
    const ring = discTexture(128, 0, true);
    const geo = new PlaneGeometry(1, 1);
    // (position along axis: 0 = at Sun, 1 = screen centre, >1 = opposite side), size (NDC-ish), colour, alpha
    const spec: [number, number, string, number, CanvasTexture][] = [
      [0.0, 0.22, '#fff3e2', 0.55, soft],
      [0.35, 0.06, '#ffd2a0', 0.25, soft],
      [0.55, 0.11, '#d9e6ff', 0.12, ring],
      [0.8, 0.04, '#ffe7c4', 0.3, soft],
      [1.15, 0.16, '#ffd9b8', 0.09, ring],
      [1.45, 0.07, '#e8ecff', 0.2, soft],
    ];
    for (const [t, size, col, alpha, tex] of spec) {
      const mat = new MeshBasicMaterial({ map: tex, color: new Color(col), transparent: true, opacity: 0, blending: AdditiveBlending, depthTest: false, depthWrite: false });
      const mesh = new Mesh(geo, mat);
      mesh.renderOrder = 100;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.ghosts.push({ mesh, mat, t, size, alpha });
    }
  }

  addOccluder(center: Vector3, radius: number, visible: () => boolean) {
    this.occluders.push({ center, radius, visible });
  }

  /** Is the Sun hidden behind a sphere from this camera position? */
  private occluded(camPos: Vector3) {
    for (const o of this.occluders) {
      if (!o.visible()) continue;
      _p.copy(o.center).sub(camPos);
      const b = _p.dot(SUN_DIR);
      if (b < 0) continue; // sphere is behind us
      const d2 = _p.lengthSq() - b * b;
      if (d2 < o.radius * o.radius) return true;
    }
    return false;
  }

  update(camera: PerspectiveCamera, dt: number) {
    // Sun in NDC
    _sunNdc.copy(camera.position).addScaledVector(SUN_DIR, 1000).project(camera);
    const onScreen = _sunNdc.z < 1 && Math.abs(_sunNdc.x) < 1.3 && Math.abs(_sunNdc.y) < 1.3;
    const target = onScreen && !this.occluded(camera.position) ? 1 : 0;
    this.fade += (target - this.fade) * (1 - Math.exp(-6 * dt));
    this.group.visible = this.fade > 0.01;
    if (!this.group.visible) return;

    // edge falloff: flare is strongest when the Sun is near the centre
    const r = Math.hypot(_sunNdc.x, _sunNdc.y);
    const edge = 1 - Math.min(1, Math.max(0, (r - 0.7) / 0.6));
    const aspect = camera.aspect;
    const dist = 1; // place in camera space at z = -1
    const h = Math.tan((camera.fov * Math.PI) / 360) * dist;

    this.group.position.copy(camera.position);
    this.group.quaternion.copy(camera.quaternion);
    for (const g of this.ghosts) {
      const nx = _sunNdc.x * (1 - g.t), ny = _sunNdc.y * (1 - g.t);
      g.mesh.position.set(nx * h * aspect, ny * h, -dist);
      const s = g.size * h * 2;
      g.mesh.scale.set(s, s, 1);
      g.mat.opacity = g.alpha * this.fade * edge * this.intensity;
    }
  }

  dispose() {
    this.ghosts.forEach((g) => { g.mat.map?.dispose(); g.mat.dispose(); });
    this.ghosts[0]?.mesh.geometry.dispose();
  }
}
