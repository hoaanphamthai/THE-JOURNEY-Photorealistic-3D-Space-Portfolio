/**
 * Photographic post stack (pmndrs/postprocessing):
 * bloom (high threshold → only Sun / city lights / glints), subtle grain, vignette, mild CA, SMAA.
 * Passes are toggled by the quality tier and by the current section (DOF only near Moon/station).
 */
import {
  EffectComposer, RenderPass, EffectPass, BloomEffect, NoiseEffect, VignetteEffect,
  ChromaticAberrationEffect, SMAAEffect, SMAAPreset, EdgeDetectionMode, BlendFunction,
  KernelSize, DepthOfFieldEffect,
} from 'postprocessing';
import { HalfFloatType, Vector2, type WebGLRenderer, type Scene, type PerspectiveCamera } from 'three';
import type { QualityTier } from './quality';

export class Post {
  composer: EffectComposer;
  bloom: BloomEffect;
  noise: NoiseEffect;
  vignette: VignetteEffect;
  ca: ChromaticAberrationEffect;
  smaa: SMAAEffect;
  dof: DepthOfFieldEffect;
  enabled = true;
  private renderPass: RenderPass;
  private fxPass: EffectPass;
  private smaaPass: EffectPass;
  private dofPass: EffectPass;

  constructor(private renderer: WebGLRenderer, private scene: Scene, private camera: PerspectiveCamera) {
    this.composer = new EffectComposer(renderer, { frameBufferType: HalfFloatType, multisampling: 0 });
    this.renderPass = new RenderPass(scene, camera);

    this.bloom = new BloomEffect({
      luminanceThreshold: 1.1, // HDR only: anything < 1.0 never blooms
      luminanceSmoothing: 0.3,
      intensity: 0.55,
      mipmapBlur: true,
      kernelSize: KernelSize.MEDIUM,
      radius: 0.6,
    });
    this.noise = new NoiseEffect({ blendFunction: BlendFunction.SOFT_LIGHT, premultiply: true });
    this.noise.blendMode.opacity.value = 0.22;
    this.vignette = new VignetteEffect({ offset: 0.32, darkness: 0.55 });
    this.ca = new ChromaticAberrationEffect({ offset: new Vector2(0.0006, 0.0006), radialModulation: true, modulationOffset: 0.4 });
    this.smaa = new SMAAEffect({ preset: SMAAPreset.MEDIUM, edgeDetectionMode: EdgeDetectionMode.COLOR });
    this.dof = new DepthOfFieldEffect(camera, { focusDistance: 0.02, focalLength: 0.05, bokehScale: 1.6, resolutionScale: 0.5 });
    this.dof.blendMode.opacity.value = 0;

    this.fxPass = new EffectPass(camera, this.bloom, this.ca, this.noise, this.vignette);
    this.dofPass = new EffectPass(camera, this.dof);
    this.smaaPass = new EffectPass(camera, this.smaa);

    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.dofPass);
    this.composer.addPass(this.fxPass);
    this.composer.addPass(this.smaaPass);
  }

  applyTier(t: QualityTier) {
    this.enabled = t.post;
    this.bloom.blendMode.opacity.value = t.bloom ? 1 : 0;
    this.noise.blendMode.opacity.value = t.grain ? 0.22 : 0;
    this.ca.blendMode.opacity.value = t.chromatic ? 1 : 0;
    this.smaaPass.enabled = t.smaa;
    this.dofAllowed = t.level >= 2;
    this.dofPass.enabled = this.dofAllowed && this.dof.blendMode.opacity.value > 0.01;
    this.fixRenderToScreen();
  }

  /** The composer only presents the LAST pass; if that one is disabled nothing reaches the screen. */
  private fixRenderToScreen() {
    const passes = this.composer.passes;
    let last = -1;
    passes.forEach((p, i) => { if (p.enabled) last = i; });
    passes.forEach((p, i) => (p.renderToScreen = i === last));
  }

  private dofAllowed = true;

  /** 0..1 how much DOF to apply (close shots only). */
  setDof(amount: number, focusDistanceNorm: number) {
    this.dof.blendMode.opacity.value = amount;
    this.dof.cocMaterial.focusDistance = focusDistanceNorm;
    const want = this.dofAllowed && amount > 0.01;
    if (want !== this.dofPass.enabled) {
      this.dofPass.enabled = want;
      this.fixRenderToScreen();
    }
  }

  setSize(w: number, h: number) {
    this.composer.setSize(w, h);
  }

  render(dt: number) {
    if (this.enabled) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.composer.dispose();
  }
}
