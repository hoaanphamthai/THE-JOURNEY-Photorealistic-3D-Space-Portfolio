// Project panel: image with subtle hover distortion (barrel ripple driven by uHover), screen-like emission.
uniform sampler2D uMap;
uniform float uHover;  // 0..1 damped
uniform float uTime;
uniform vec2 uMouse;   // panel-local uv of the cursor
varying vec2 vUv;

void main() {
  vec2 uv = vUv;
  vec2 d = uv - uMouse;
  float dist = length(d);
  // gentle lens bulge under the cursor + travelling ripple, both scaled by hover amount
  float bulge = exp(-dist * dist * 18.0) * 0.035 * uHover;
  float ripple = sin(dist * 40.0 - uTime * 4.0) * 0.004 * uHover;
  uv -= normalize(d + 1e-5) * (bulge + ripple);
  vec3 col = texture2D(uMap, uv).rgb;
  // scanline-free "backlit display": slight vignette, brightened on hover
  float vig = smoothstep(0.0, 0.25, uv.x) * smoothstep(1.0, 0.75, uv.x) * smoothstep(0.0, 0.25, uv.y) * smoothstep(1.0, 0.75, uv.y);
  col *= mix(0.65, 1.0, vig) * (0.9 + 0.9 * uHover);
  gl_FragColor = vec4(col, 1.0);
}
