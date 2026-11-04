varying vec3 vNormalV;
varying vec3 vViewDir;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vNormalV = normalMatrix * normal;
  vViewDir = mv.xyz;
  gl_Position = projectionMatrix * mv;
}
