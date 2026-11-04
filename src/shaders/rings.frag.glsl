// Saturn rings: radial texture lookup, planet shadow (analytic sphere occlusion towards the Sun),
// lit from both sides with a back-scatter term when the Sun is behind the rings.
uniform sampler2D uRing;      // 1D-ish strip: x = radius 0..1 between inner/outer, rgba
uniform float uInner;
uniform float uOuter;
uniform float uPlanetRadius;
uniform vec3 uSunDir;
uniform vec3 uPlanetPos;
uniform float uExposure;

varying vec3 vPosW;
varying vec3 vNormalW;

void main() {
  vec3 rel = vPosW - uPlanetPos;
  float r = length(rel);
  float u = (r - uInner) / (uOuter - uInner);
  if (u < 0.0 || u > 1.0) discard;
  vec4 tex = texture2D(uRing, vec2(u, 0.5));
  if (tex.a < 0.02) discard;

  vec3 L = normalize(uSunDir);
  // Planet shadow: does the ray from this point towards the Sun hit the planet sphere?
  float b = dot(rel, L);
  float h = b * b - (dot(rel, rel) - uPlanetRadius * uPlanetRadius);
  float shadow = 1.0;
  if (b < 0.0 && h > 0.0) {
    // soften the edge with the penumbra width (Sun angular size ≈ 0.27°, tiny — keep it crisp but anti-aliased)
    float d = sqrt(dot(rel, rel) - b * b) - uPlanetRadius; // negative inside the shadow cylinder
    shadow = smoothstep(-0.02 * uPlanetRadius, 0.02 * uPlanetRadius, d);
  }

  vec3 N = normalize(vNormalW);
  vec3 V = normalize(cameraPosition - vPosW);
  float NdotL = dot(N, L);
  float NdotV = dot(N, V);
  // Icy particles: lit side diffuse, unlit side receives transmitted light
  float lit = max(abs(NdotL), 0.0);
  float sameSide = step(0.0, NdotL * NdotV);
  float diffuse = mix(0.35, 1.0, sameSide) * lit;
  // Forward scattering when looking towards the Sun through the rings
  float mu = dot(-V, L);
  float forward = pow(max(mu, 0.0), 24.0) * 0.6 * (1.0 - tex.a);

  vec3 col = tex.rgb * (diffuse * shadow + forward) * uExposure;
  gl_FragColor = vec4(col, tex.a);
}
