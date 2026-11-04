// Starfield fragment — soft Gaussian disc (optics PSF), no flicker.
varying vec3 vColor;
varying float vAlpha;

void main() {
  vec2 p = gl_PointCoord - 0.5;
  float d2 = dot(p, p) * 4.0;           // 0 centre → 1 edge
  float core = exp(-d2 * 6.0);          // tight Gaussian core
  float halo = exp(-d2 * 1.5) * 0.15;   // faint PSF skirt
  float a = (core + halo) * vAlpha;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vColor * (core + halo), a);
}
