// Starfield vertex shader — real catalogue positions, magnitude → size/brightness. No twinkle.
attribute float aMag;   // apparent magnitude
attribute vec3 aColor;  // linear RGB from B-V index
uniform float uPixelRatio;
uniform float uScale;   // overall size multiplier (quality tier)
varying vec3 vColor;
varying float vAlpha;

void main() {
  // Flux ratio: each magnitude step = 2.512×. Normalise so mag 0 → 1.0, mag 6 → ~0.004.
  float flux = pow(2.512, -aMag);
  // Perceptual compression so faint stars stay visible without blowing out bright ones.
  float bright = pow(flux, 0.45);
  vColor = aColor * (0.25 + 2.6 * bright); // HDR: bright stars > 1.0 feed bloom slightly
  vAlpha = clamp(0.25 + bright, 0.0, 1.0);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = (1.0 + 4.5 * bright) * uPixelRatio * uScale;
}
