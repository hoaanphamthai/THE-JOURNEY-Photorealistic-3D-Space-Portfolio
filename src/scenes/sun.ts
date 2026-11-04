/**
 * The Sun: ONE DirectionalLight for the whole system + a visible HDR disc with limb darkening,
 * a corona billboard and a restrained, readPixels-free lens flare. The disc is camera-locked along
 * SUN_DIR so it behaves like a body at infinity.
 */
import {
  DirectionalLight, HemisphereLight, Group, Mesh, SphereGeometry, ShaderMaterial, PlaneGeometry,
  AdditiveBlending, Vector3, type PerspectiveCamera, type Object3D,
} from 'three';
import sunVert from '../shaders/sun.vert.glsl';
import sunFrag from '../shaders/sun.frag.glsl';
import quadVert from '../shaders/quad.vert.glsl';
import coronaFrag from '../shaders/corona.frag.glsl';
import { SUN_DIR, SUN_DISTANCE, SUN_ANGULAR_RADIUS } from '../config/universe';
import { Flare } from './flare';

const _v = new Vector3();

export class Sun {
  group = new Group();
  light: DirectionalLight;
  fill: HemisphereLight;
  flare = new Flare();
  private disc: Mesh;
  private corona: Mesh;
  private coronaMat: ShaderMaterial;

  constructor() {
    this.light = new DirectionalLight(0xfff4e6, 3.2);
    this.light.position.copy(SUN_DIR).multiplyScalar(50);
    this.light.castShadow = true;
    const s = this.light.shadow;
    s.mapSize.set(2048, 2048);
    s.bias = -0.00005;
    s.normalBias = 0.002;
    s.camera.near = 40;
    s.camera.far = 60;
    s.camera.left = s.camera.bottom = -0.25;
    s.camera.right = s.camera.top = 0.25;

    // Real vacuum: almost no fill. ~1% so the dark side isn't mathematically zero.
    this.fill = new HemisphereLight(0x223355, 0x000000, 0.03);

    const r = Math.tan(SUN_ANGULAR_RADIUS) * SUN_DISTANCE;
    this.disc = new Mesh(
      new SphereGeometry(r, 48, 24),
      new ShaderMaterial({ vertexShader: sunVert, fragmentShader: sunFrag, uniforms: { uIntensity: { value: 40 } } }),
    );
    this.disc.frustumCulled = false;

    this.coronaMat = new ShaderMaterial({
      vertexShader: quadVert, fragmentShader: coronaFrag,
      uniforms: { uIntensity: { value: 14 }, uTime: { value: 0 } },
      transparent: true, depthWrite: false, blending: AdditiveBlending,
    });
    this.corona = new Mesh(new PlaneGeometry(r * 26, r * 26), this.coronaMat);
    this.corona.frustumCulled = false;

    this.group.add(this.disc, this.corona);
  }

  attach(scene: Object3D) {
    scene.add(this.light, this.light.target, this.fill, this.group, this.flare.group);
  }

  /** Point the shadow frustum at a small target (the station) so 2048² covers it crisply. */
  focusShadow(target: Vector3) {
    this.light.target.position.copy(target);
    this.light.position.copy(target).addScaledVector(SUN_DIR, 50);
  }

  update(camera: PerspectiveCamera, elapsed: number, dt: number) {
    _v.copy(camera.position).addScaledVector(SUN_DIR, SUN_DISTANCE);
    this.group.position.copy(_v);
    this.corona.quaternion.copy(camera.quaternion);
    this.coronaMat.uniforms.uTime.value = elapsed;
    this.flare.update(camera, dt);
  }

  dispose() {
    this.disc.geometry.dispose();
    (this.disc.material as ShaderMaterial).dispose();
    this.corona.geometry.dispose();
    this.coronaMat.dispose();
    this.flare.dispose();
  }
}
