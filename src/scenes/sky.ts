/**
 * Sky: real-catalogue starfield (HYG, mag ≤ 7) + Milky Way panorama.
 * Both are camera-locked (translated to the camera every frame) so they sit at infinity.
 * Star positions are rotated from equatorial J2000 to galactic so they line up with the panorama.
 */
import {
  BufferGeometry, Float32BufferAttribute, Points, ShaderMaterial, AdditiveBlending, Group,
  Mesh, SphereGeometry, MeshBasicMaterial, BackSide, Matrix3, Vector3, type Texture, Color,
} from 'three';
import starsVert from '../shaders/stars.vert.glsl';
import starsFrag from '../shaders/stars.frag.glsl';
import { bvToRGB } from '../utils/math';
import type { Assets } from '../core/assets';

const SKY_RADIUS = 9000;

// Equatorial (J2000) → Galactic rotation (IAU 1958 definition, Hipparcos values)
const EQ_TO_GAL = new Matrix3().set(
  -0.0548755604, -0.8734370902, -0.4838350155,
   0.4941094279, -0.4448296300,  0.7469822445,
  -0.8676661490, -0.1980763734,  0.4559837762,
);

export class Sky {
  group = new Group();
  stars: Points | null = null;
  private starMat: ShaderMaterial;
  private milky: Mesh | null = null;

  constructor() {
    this.starMat = new ShaderMaterial({
      vertexShader: starsVert,
      fragmentShader: starsFrag,
      uniforms: { uPixelRatio: { value: 1 }, uScale: { value: 1 } },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: AdditiveBlending,
    });
    this.group.renderOrder = -10;
  }

  async load(assets: Assets, onStars?: (p: number) => void, onMilky?: (p: number) => void) {
    const [buf, tex] = await Promise.all([
      assets.binary('/assets/stars/stars.bin', onStars).catch(() => null),
      assets.texture('/assets/textures/sky/milkyway.webp', { onProgress: onMilky }).catch(() => null),
    ]);
    if (buf) this.buildStars(buf);
    else this.buildStars(this.proceduralStars());
    if (tex) this.buildMilkyWay(tex);
  }

  /** Fallback when stars.bin is missing: random isotropic sky with a plausible magnitude distribution. */
  private proceduralStars(n = 6000): ArrayBuffer {
    const f = new Float32Array(n * 5);
    for (let i = 0; i < n; i++) {
      const z = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - z * z);
      f.set([r * Math.cos(a), r * Math.sin(a), z, 2 + Math.pow(Math.random(), 0.3) * 5, Math.random() * 1.6 - 0.2], i * 5);
    }
    return f.buffer;
  }

  private buildStars(buf: ArrayBuffer) {
    const f = new Float32Array(buf);
    const n = f.length / 5;
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), mag = new Float32Array(n);
    const v = new Vector3();
    for (let i = 0; i < n; i++) {
      v.set(f[i * 5], f[i * 5 + 1], f[i * 5 + 2]).applyMatrix3(EQ_TO_GAL);
      // galactic (x→centre, y→l=90°, z→NGP) to three.js (X=centre, Y=up, Z=-y) — see README
      pos[i * 3] = v.x * SKY_RADIUS;
      pos[i * 3 + 1] = v.z * SKY_RADIUS;
      pos[i * 3 + 2] = -v.y * SKY_RADIUS;
      mag[i] = f[i * 5 + 3];
      const [r, g, b] = bvToRGB(f[i * 5 + 4]);
      col[i * 3] = r; col[i * 3 + 1] = g; col[i * 3 + 2] = b;
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new Float32BufferAttribute(col, 3));
    geo.setAttribute('aMag', new Float32BufferAttribute(mag, 1));
    this.stars = new Points(geo, this.starMat);
    this.stars.frustumCulled = false;
    this.group.add(this.stars);
  }

  private buildMilkyWay(tex: Texture) {
    const geo = new SphereGeometry(SKY_RADIUS * 0.98, 48, 24);
    // faint and natural: scale the panorama down so it reads as a dim band, not a backdrop
    const mat = new MeshBasicMaterial({ map: tex, side: BackSide, depthWrite: false, depthTest: false, color: new Color(0.85, 0.85, 0.9) });
    this.milky = new Mesh(geo, mat);
    this.milky.renderOrder = -11;
    // panorama u=0.5 sits at galactic centre; rotate so +X faces it (matches the star transform)
    this.milky.rotation.y = -Math.PI / 2;
    this.group.add(this.milky);
  }

  setQuality(pixelRatio: number, scale: number) {
    this.starMat.uniforms.uPixelRatio.value = pixelRatio;
    this.starMat.uniforms.uScale.value = scale;
  }

  update(cameraPos: Vector3) {
    this.group.position.copy(cameraPos);
  }

  dispose() {
    this.stars?.geometry.dispose();
    this.starMat.dispose();
    if (this.milky) { this.milky.geometry.dispose(); (this.milky.material as MeshBasicMaterial).dispose(); }
  }
}
