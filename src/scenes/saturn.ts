/**
 * Saturn: banded planet with ring shadow (analytic, in onBeforeCompile), rings with planet shadow
 * (rings.frag), correct axial tilt, oblateness, slow rotation. Skills are moonlets in the ring plane.
 */
import { type Camera,
  Group, Mesh, SphereGeometry, MeshStandardMaterial, ShaderMaterial, RingGeometry, DoubleSide,
  Vector3, InstancedMesh, IcosahedronGeometry, Object3D, Color, type Texture, LOD,
} from 'three';
import ringsVert from '../shaders/rings.vert.glsl';
import ringsFrag from '../shaders/rings.frag.glsl';
import { SATURN_POS, SATURN_RADIUS, SATURN_TILT, RING_INNER, RING_OUTER, SUN_DIR } from '../config/universe';
import { content } from '../config/content';
import type { Assets } from '../core/assets';
import { solidTexture } from './earth';

const _o = new Object3D();
const _c = new Color();
const BASE = new Color(0xd8d4cc);
const WARM = new Color(0xffd9a8); // highlighted moonlet: lit a touch warmer/brighter, no glow

export class Saturn {
  group = new Group();
  tilt = new Group(); // tilted frame: planet + rings + moonlets
  lod = new LOD();
  rings: Mesh;
  moonlets: InstancedMesh;
  private planetMat: MeshStandardMaterial;
  private ringMat: ShaderMaterial;
  private geos: SphereGeometry[] = [];
  private moonGeo: IcosahedronGeometry;
  private moonMat: MeshStandardMaterial;
  /** Per-skill positions in tilt-local space. */
  skillLocal: Vector3[] = [];
  highlight = -1;
  private hl = new Float32Array(content.skills.length);
  loaded = false;
  private loading: Promise<void> | null = null;

  constructor() {
    this.tilt.rotation.z = SATURN_TILT;
    this.tilt.updateMatrix();
    const ringNormal = new Vector3(0, 1, 0).applyQuaternion(this.tilt.quaternion);

    const ringUniforms = {
      uRing: { value: solidTexture(200, 190, 170, 160) },
      uInner: { value: RING_INNER },
      uOuter: { value: RING_OUTER },
      uPlanetRadius: { value: SATURN_RADIUS },
      uSunDir: { value: SUN_DIR.clone() },
      uPlanetPos: { value: SATURN_POS.clone() },
      uExposure: { value: 1.0 },
    };

    this.planetMat = new MeshStandardMaterial({ color: 0xc9b58a, roughness: 0.9, metalness: 0 });
    // Ring shadow on the planet: project each fragment along the Sun direction onto the ring plane
    // and sample ring opacity there. Cheaper and sharper than a shadow map at this scale.
    this.planetMat.onBeforeCompile = (s) => {
      Object.assign(s.uniforms, {
        uSunDir: ringUniforms.uSunDir, uRingTex: ringUniforms.uRing, uInner: ringUniforms.uInner,
        uOuter: ringUniforms.uOuter, uPlanetPos: ringUniforms.uPlanetPos, uRingNormal: { value: ringNormal },
      });
      s.vertexShader = s.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      s.fragmentShader = s.fragmentShader
        .replace('#include <common>', `#include <common>
          varying vec3 vWP;
          uniform vec3 uSunDir; uniform sampler2D uRingTex; uniform float uInner; uniform float uOuter;
          uniform vec3 uPlanetPos; uniform vec3 uRingNormal;
          float ringShadow(vec3 p) {
            vec3 L = normalize(uSunDir);
            float denom = dot(uRingNormal, L);
            if (abs(denom) < 1e-4) return 1.0;
            float t = dot(uRingNormal, uPlanetPos - p) / denom;
            if (t < 0.0) return 1.0;                        // ring plane lies away from the Sun
            float r = length(p + L * t - uPlanetPos);
            float u = (r - uInner) / (uOuter - uInner);
            if (u < 0.0 || u > 1.0) return 1.0;
            return 1.0 - texture2D(uRingTex, vec2(u, 0.5)).a * 0.92;
          }`)
        .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
          float rs = ringShadow(vWP);
          reflectedLight.directDiffuse *= rs; reflectedLight.directSpecular *= rs;`);
    };
    for (const [segs, dist] of [[128, 0], [64, 120], [24, 400]] as const) {
      const g = new SphereGeometry(SATURN_RADIUS, segs, segs / 2);
      g.scale(1, 0.902, 1); // oblateness: polar radius 0.902 × equatorial
      this.geos.push(g);
      this.lod.addLevel(new Mesh(g, this.planetMat), dist);
    }

    this.ringMat = new ShaderMaterial({
      vertexShader: ringsVert, fragmentShader: ringsFrag, uniforms: ringUniforms,
      side: DoubleSide, transparent: true, depthWrite: false,
    });
    const rg = new RingGeometry(RING_INNER, RING_OUTER, 256, 1);
    rg.rotateX(-Math.PI / 2);
    this.rings = new Mesh(rg, this.ringMat);
    this.rings.renderOrder = 1;

    // Skill moonlets: shepherd-moon-sized icy rocks in and around the ring system
    this.moonGeo = new IcosahedronGeometry(1, 2);
    this.moonMat = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0 });
    const n = content.skills.length;
    this.moonlets = new InstancedMesh(this.moonGeo, this.moonMat, n);
    content.skills.forEach((sk, i) => {
      const a = (i / n) * Math.PI * 2 + 0.6;
      const r = RING_OUTER + 3 + ((i * 7) % 5) * 1.6; // scattered just outside the A ring
      const p = new Vector3(Math.cos(a) * r, 0.9 * (((i * 3) % 5) - 2), Math.sin(a) * r);
      this.skillLocal.push(p);
      _o.position.copy(p);
      _o.rotation.set(i, i * 1.7, i * 0.3);
      _o.scale.setScalar(0.35 + sk.level * 0.55);
      _o.updateMatrix();
      this.moonlets.setMatrixAt(i, _o.matrix);
      this.moonlets.setColorAt(i, BASE);
    });
    this.moonlets.instanceMatrix.needsUpdate = true;

    this.tilt.add(this.lod, this.rings, this.moonlets);
    this.group.position.copy(SATURN_POS);
    this.group.add(this.tilt);
    this.group.updateMatrixWorld(true);
  }

  load(assets: Assets, onProgress?: (p: number) => void) {
    if (this.loading) return this.loading;
    const p = [0, 0];
    const rep = () => onProgress?.((p[0] + p[1]) / 2);
    this.loading = Promise.all([
      assets.texture('/assets/textures/saturn/albedo.webp', { onProgress: (v) => { p[0] = v; rep(); } }).catch(() => null),
      assets.texture('/assets/textures/saturn/ring.webp', { onProgress: (v) => { p[1] = v; rep(); } }).catch(() => null),
    ]).then(([albedo, ring]) => {
      if (albedo) { this.planetMat.map = albedo as Texture; this.planetMat.color.set(0xffffff); this.planetMat.needsUpdate = true; }
      if (ring) this.ringMat.uniforms.uRing.value = ring;
      this.loaded = true;
    });
    return this.loading;
  }

  /** World-space position of skill i (for DOM labels). */
  skillWorld(i: number, out: Vector3) {
    return out.copy(this.skillLocal[i]).applyMatrix4(this.tilt.matrixWorld);
  }

  update(dt: number, camera: Camera) {
    this.lod.rotation.y += dt * 0.012;
    this.lod.update(camera);
    // Damped highlight: hovered moonlet brightens, others dim (albedo only — no glow in vacuum)
    let dirty = false;
    for (let i = 0; i < this.hl.length; i++) {
      const target = this.highlight < 0 ? 0 : i === this.highlight ? 1 : -1;
      const nv = this.hl[i] + (target - this.hl[i]) * (1 - Math.exp(-8 * dt));
      if (Math.abs(nv - this.hl[i]) > 1e-4) { this.hl[i] = nv; dirty = true; }
    }
    if (dirty) {
      for (let i = 0; i < this.hl.length; i++) {
        const h = this.hl[i];
        _c.copy(BASE);
        if (h > 0) _c.lerp(WARM, h).multiplyScalar(1 + 0.35 * h);
        else _c.multiplyScalar(1 + 0.6 * h); // h ∈ [-1,0] → ×0.4 at full dim
        this.moonlets.setColorAt(i, _c);
      }
      this.moonlets.instanceColor!.needsUpdate = true;
    }
  }

  distanceTo(p: Vector3) {
    return p.distanceTo(this.group.position) - RING_OUTER;
  }

  dispose() {
    this.geos.forEach((g) => g.dispose());
    this.rings.geometry.dispose();
    this.ringMat.dispose();
    this.planetMat.dispose();
    this.moonGeo.dispose();
    this.moonMat.dispose();
    this.moonlets.dispose();
  }
}
