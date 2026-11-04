import { WebGLRenderer, ACESFilmicToneMapping, SRGBColorSpace, PerspectiveCamera, Scene } from 'three';

/**
 * Single renderer. Logarithmic depth buffer handles the 1 → 10,000 unit range
 * (Earth surface detail vs Saturn at 700 units) without z-fighting.
 */
export function createRenderer(canvas: HTMLCanvasElement) {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: false, // SMAA in post is cheaper and plays nicely with HDR
    powerPreference: 'high-performance',
    logarithmicDepthBuffer: true,
    stencil: false,
    depth: true,
  });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 1);
  return renderer;
}

export function createCamera() {
  // near/far tuned together with the log depth buffer
  const cam = new PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.01, 20000);
  cam.position.set(0, 0, 3);
  return cam;
}

export function createScene() {
  return new Scene(); // no fog, ever
}
