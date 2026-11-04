/**
 * Earth: custom surface shader (day/night/specular/normal), cloud shell, atmospheric scattering shell.
 * LOD: three sphere resolutions switched by distance. Textures stream in after the procedural fallback.
 */
import { type Camera,
  Group, Mesh, SphereGeometry, ShaderMaterial, MeshStandardMaterial, LOD,
  BackSide, Vector3, type Texture, DataTexture, RGBAFormat, AdditiveBlending, FrontSide,
} from 'three';
import earthVert from '../shaders/earth.vert.glsl';
import earthFrag from '../shaders/earth.frag.glsl';
import atmoVert from '../shaders/atmosphere.vert.glsl';
import atmoFrag from '../shaders/atmosphere.frag.glsl';
import { EARTH_POS, EARTH_RADIUS, SUN_DIR } from '../config/universe';
import type { Assets } from '../core/assets';

/** 1×1 texture so shaders compile before real maps arrive. */
export function solidTexture(r: number, g: number, b: number, a = 255) {
  const t = new DataTexture(new Uint8Array([r, g, b, a]), 1, 1, RGBAFormat);
  t.needsUpdate = true;
  return t;
}

export class Earth {
  group = new Group();
  lod = new LOD();
  private surfaceMat: ShaderMaterial;
  private cloudMat: MeshStandardMaterial;
  private clouds: Mesh;
  private atmo: Mesh;
  private atmoMat: ShaderMaterial;
  private geos: SphereGeometry[] = [];
  loaded = false;
  private loading: Promise<void> | null = null;
  readonly ROT_SPEED = (2 * Math.PI) / 1400; // one rotation per ~23 min — slow, visible drift

  constructor() {
    this.surfaceMat = new ShaderMaterial({
      vertexShader: earthVert,
      fragmentShader: earthFrag,
      uniforms: {
        uDay: { value: solidTexture(40, 70, 120) },
        uNight: { value: solidTexture(0, 0, 0) },
        uSpecular: { value: solidTexture(255, 255, 255) },
        uNormal: { value: solidTexture(128, 128, 255) },
        uSunDir: { value: SUN_DIR.clone() },
        uExposure: { value: 1.0 },
      },
    });
    for (const [segs, dist] of [[160, 0], [96, 6], [40, 30]] as const) {
      const g = new SphereGeometry(EARTH_RADIUS, segs, segs / 2);
      this.geos.push(g);
      this.lod.addLevel(new Mesh(g, this.surfaceMat), dist);
    }

    this.cloudMat = new MeshStandardMaterial({
      color: 0xffffff, transparent: true, opacity: 0.0, roughness: 1, metalness: 0, depthWrite: false, side: FrontSide,
    });
    this.clouds = new Mesh(new SphereGeometry(EARTH_RADIUS * 1.006, 96, 48), this.cloudMat);

    this.atmoMat = new ShaderMaterial({
      vertexShader: atmoVert, fragmentShader: atmoFrag,
      uniforms: {
        uSunDir: { value: SUN_DIR.clone() },
        uPlanetRadius: { value: EARTH_RADIUS },
        uAtmoRadius: { value: EARTH_RADIUS * 1.03 },
        uIntensity: { value: 3.0 },
      },
      side: BackSide, transparent: true, depthWrite: false, blending: AdditiveBlending,
    });
    this.atmo = new Mesh(new SphereGeometry(EARTH_RADIUS * 1.03, 96, 48), this.atmoMat);
    this.atmo.renderOrder = 2;

    // Earth's axial tilt (23.44°) relative to the fixed Sun direction gives a believable terminator
    this.group.rotation.z = (23.44 * Math.PI) / 180;
    this.group.position.copy(EARTH_POS);
    this.group.add(this.lod, this.clouds, this.atmo);
  }

  load(assets: Assets, onProgress?: (p: number) => void) {
    if (this.loading) return this.loading;
    const parts = [0, 0, 0, 0, 0];
    const report = () => onProgress?.(parts.reduce((a, b) => a + b, 0) / parts.length);
    const t = (i: number, url: string, srgb = true) =>
      assets.texture(url, { srgb, onProgress: (p) => { parts[i] = p; report(); } }).catch(() => null);
    this.loading = Promise.all([
      t(0, '/assets/textures/earth/day.webp'),
      t(1, '/assets/textures/earth/night.webp'),
      t(2, '/assets/textures/earth/specular.webp', false),
      t(3, '/assets/textures/earth/normal.webp', false),
      t(4, '/assets/textures/earth/clouds.webp', false),
    ]).then(([day, night, spec, nrm, clouds]) => {
      const u = this.surfaceMat.uniforms;
      if (day) u.uDay.value = day;
      if (night) u.uNight.value = night;
      if (spec) u.uSpecular.value = spec;
      if (nrm) u.uNormal.value = nrm;
      if (clouds) {
        this.cloudMat.alphaMap = clouds as Texture;
        this.cloudMat.opacity = 0.95;
        this.cloudMat.needsUpdate = true;
      }
      this.loaded = true;
    });
    return this.loading;
  }

  update(dt: number, camera: Camera) {
    this.lod.rotation.y += this.ROT_SPEED * dt;
    this.clouds.rotation.y += this.ROT_SPEED * 1.18 * dt; // clouds drift slightly faster than the ground
    this.lod.update(camera);
  }

  /** Distance from camera to the surface, for lazy loading decisions. */
  distanceTo(p: Vector3) {
    return p.distanceTo(this.group.position) - EARTH_RADIUS;
  }

  dispose() {
    this.geos.forEach((g) => g.dispose());
    this.clouds.geometry.dispose();
    this.atmo.geometry.dispose();
    this.surfaceMat.dispose();
    this.cloudMat.dispose();
    this.atmoMat.dispose();
  }
}
