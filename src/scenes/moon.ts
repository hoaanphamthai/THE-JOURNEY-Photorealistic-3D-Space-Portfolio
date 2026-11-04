/**
 * Moon: displacement + derived normal mapping, near-Lambertian regolith with opposition surge
 * (brightening when Sun is behind the camera) via onBeforeCompile. Hard shadows come for free:
 * MeshStandardMaterial lit by one directional light and ~0 fill.
 */
import { Group, Mesh, SphereGeometry, MeshStandardMaterial, LOD, Vector3, type Texture, type Camera } from 'three';
import { MOON_POS, MOON_RADIUS, SUN_DIR } from '../config/universe';
import type { Assets } from '../core/assets';

export class Moon {
  group = new Group();
  lod = new LOD();
  private mat: MeshStandardMaterial;
  private geos: SphereGeometry[] = [];
  loaded = false;
  private loading: Promise<void> | null = null;

  constructor() {
    this.mat = new MeshStandardMaterial({ color: 0x8f8f8a, roughness: 1, metalness: 0 });
    this.mat.onBeforeCompile = (s) => {
      s.uniforms.uSunDir = { value: SUN_DIR.clone() };
      s.fragmentShader = s.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uSunDir;')
        .replace(
          '#include <lights_fragment_end>',
          `#include <lights_fragment_end>
          // Opposition surge: lunar regolith back-scatters strongly when the phase angle → 0 (Hapke-ish).
          vec3 Vw = normalize(cameraPosition - vWorldPosition);
          float phase = max(dot(Vw, normalize(uSunDir)), 0.0);
          float surge = 1.0 + 0.35 * pow(phase, 8.0);
          reflectedLight.directDiffuse *= surge;`,
        );
      // need vWorldPosition in fragment
      s.vertexShader = s.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWorldPosition;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWorldPosition;');
    };
    for (const [segs, dist] of [[256, 0], [96, 3], [32, 12]] as const) {
      const g = new SphereGeometry(MOON_RADIUS, segs, segs / 2);
      this.geos.push(g);
      const m = new Mesh(g, this.mat);
      m.castShadow = m.receiveShadow = false; // self-shadowing on a sphere = terminator; handled by lighting
      this.lod.addLevel(m, dist);
    }
    // Moon is tidally locked; we present the near side towards Earth (origin)
    this.lod.lookAt(new Vector3(0, 0, 0));
    this.lod.rotateY(Math.PI / 2);
    this.group.position.copy(MOON_POS);
    this.group.add(this.lod);
  }

  load(assets: Assets, onProgress?: (p: number) => void) {
    if (this.loading) return this.loading;
    const p = [0, 0];
    const rep = () => onProgress?.((p[0] + p[1]) / 2);
    this.loading = Promise.all([
      assets.texture('/assets/textures/moon/albedo.webp', { onProgress: (v) => { p[0] = v; rep(); } }).catch(() => null),
      assets.texture('/assets/textures/moon/height.webp', { srgb: false, onProgress: (v) => { p[1] = v; rep(); } }).catch(() => null),
    ]).then(([albedo, height]) => {
      if (albedo) { this.mat.map = albedo as Texture; this.mat.color.set(0xffffff); }
      if (height) {
        this.mat.displacementMap = height as Texture;
        this.mat.displacementScale = MOON_RADIUS * 0.02;
        this.mat.displacementBias = -MOON_RADIUS * 0.01;
        this.mat.bumpMap = height as Texture;
        this.mat.bumpScale = 0.012;
      }
      this.mat.needsUpdate = true;
      this.loaded = true;
    });
    return this.loading;
  }

  update(camera: Camera) {
    this.lod.update(camera);
  }

  distanceTo(p: Vector3) {
    return p.distanceTo(this.group.position) - MOON_RADIUS;
  }

  dispose() {
    this.geos.forEach((g) => g.dispose());
    this.mat.dispose();
  }
}
