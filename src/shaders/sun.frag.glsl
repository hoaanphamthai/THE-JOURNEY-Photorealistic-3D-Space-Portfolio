// Sun disc: emissive HDR with limb darkening (Eddington approximation I(μ)/I(1) = 0.4 + 0.6 μ).
uniform float uIntensity;
varying vec3 vNormalV;
varying vec3 vViewDir;

void main() {
  float mu = clamp(dot(normalize(vNormalV), normalize(-vViewDir)), 0.0, 1.0);
  float limb = 0.4 + 0.6 * mu;
  // Photosphere colour ~5800 K after atmosphere-free white balance: near white with a warm tint
  vec3 col = vec3(1.0, 0.96, 0.9) * limb * uIntensity;
  gl_FragColor = vec4(col, 1.0);
}
