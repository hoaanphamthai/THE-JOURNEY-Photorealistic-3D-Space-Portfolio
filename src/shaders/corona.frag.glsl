// Corona billboard: radial falloff (K-corona ~ r^-2.5 brightness) with faint streamer structure.
uniform float uIntensity;
uniform float uTime;
varying vec2 vUv;

float hash(float n) { return fract(sin(n) * 43758.5453); }

void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  float r = length(p);
  if (r > 1.0) discard;
  float ang = atan(p.y, p.x);
  // slow, very low-amplitude streamer modulation (coronal structure, not twinkle)
  float streamers = 0.85 + 0.15 * (sin(ang * 7.0 + hash(1.0) * 6.28) * sin(ang * 3.0 + uTime * 0.02));
  float fall = pow(max(1.0 - r, 0.0), 2.5) / (1.0 + 40.0 * r * r);
  vec3 col = vec3(1.0, 0.93, 0.82) * fall * streamers * uIntensity;
  gl_FragColor = vec4(col, clamp(fall * 3.0, 0.0, 1.0));
}
