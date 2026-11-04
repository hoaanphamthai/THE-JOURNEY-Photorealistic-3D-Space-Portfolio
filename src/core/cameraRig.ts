/**
 * Scroll-driven spacecraft camera.
 * - CatmullRom splines through CAMERA_KEYS (position + look target), parameterised by scroll progress.
 * - Progress is damped (inertia), mouse parallax is damped and tiny, plus a slow "breathing" drift.
 * - FOV interpolates per key. No shake, no whip pans.
 */
import { CatmullRomCurve3, PerspectiveCamera, Vector3, Quaternion, Matrix4 } from 'three';
import { CAMERA_KEYS } from '../config/universe';
import { damp, clamp } from '../utils/math';

const _pos = new Vector3();
const _look = new Vector3();
const _up = new Vector3(0, 1, 0);
const _m = new Matrix4();
const _q = new Quaternion();
const _right = new Vector3();
const _upCam = new Vector3();

export class CameraRig {
  target = 0; // where scroll wants us
  progress = 0; // damped
  mouse = { x: 0, y: 0 }; // -1..1
  private mouseD = { x: 0, y: 0 };
  private posCurve: CatmullRomCurve3;
  private lookCurve: CatmullRomCurve3;
  private keyT: number[];
  /** When set, overrides the spline (used for project panel zoom). 0..1 blend. */
  override: { pos: Vector3; look: Vector3; weight: number } | null = null;
  reducedMotion = false;

  constructor(public camera: PerspectiveCamera) {
    this.posCurve = new CatmullRomCurve3(CAMERA_KEYS.map((k) => k.pos), false, 'centripetal', 0.5);
    this.lookCurve = new CatmullRomCurve3(CAMERA_KEYS.map((k) => k.look), false, 'centripetal', 0.5);
    this.keyT = CAMERA_KEYS.map((k) => k.t);
    this.update(0, 0, true);
  }

  /** Maps scroll progress → curve parameter so each key sits at its own t. */
  private curveU(p: number) {
    const n = this.keyT.length - 1;
    for (let i = 0; i < n; i++) {
      if (p <= this.keyT[i + 1]) {
        const u = (p - this.keyT[i]) / (this.keyT[i + 1] - this.keyT[i]);
        // ease each segment slightly so we linger at destinations
        const e = u * u * (3 - 2 * u) * 0.35 + u * 0.65;
        return (i + e) / n;
      }
    }
    return 1;
  }

  private fovAt(p: number) {
    const k = CAMERA_KEYS;
    for (let i = 0; i < k.length - 1; i++) {
      if (p <= k[i + 1].t) {
        const u = (p - k[i].t) / (k[i + 1].t - k[i].t);
        return (k[i].fov ?? 42) + ((k[i + 1].fov ?? 42) - (k[i].fov ?? 42)) * u;
      }
    }
    return k[k.length - 1].fov ?? 42;
  }

  update(dt: number, elapsed: number, snap = false) {
    // Inertia: a heavy spacecraft, not a cursor
    this.progress = snap ? this.target : damp(this.progress, this.target, 2.2, dt);
    this.mouseD.x = damp(this.mouseD.x, this.mouse.x, 2.5, dt);
    this.mouseD.y = damp(this.mouseD.y, this.mouse.y, 2.5, dt);

    const p = clamp(this.progress, 0, 1);
    const u = this.curveU(p);
    // getPoint (not getPointAt): the curve parameter is segment-uniform, so (i / n) lands exactly on key i
    this.posCurve.getPoint(u, _pos);
    this.lookCurve.getPoint(u, _look);

    if (this.override && this.override.weight > 0) {
      _pos.lerp(this.override.pos, this.override.weight);
      _look.lerp(this.override.look, this.override.weight);
    }

    // Build orientation, then add parallax + breathing in camera space (so it never breaks the look-at)
    _m.lookAt(_pos, _look, _up);
    _q.setFromRotationMatrix(_m);
    _right.set(1, 0, 0).applyQuaternion(_q);
    _upCam.set(0, 1, 0).applyQuaternion(_q);

    const dist = _pos.distanceTo(_look);
    const amp = this.reducedMotion ? 0 : dist * 0.012;
    const breathe = this.reducedMotion ? 0 : dist * 0.0025;
    _pos.addScaledVector(_right, this.mouseD.x * amp + Math.sin(elapsed * 0.23) * breathe);
    _pos.addScaledVector(_upCam, -this.mouseD.y * amp * 0.6 + Math.sin(elapsed * 0.17 + 1.3) * breathe * 0.7);

    this.camera.position.copy(_pos);
    this.camera.quaternion.copy(_q);
    // tiny roll from parallax gives the weighted feel
    this.camera.rotateZ(-this.mouseD.x * 0.004);

    const fov = this.fovAt(p);
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }
}
