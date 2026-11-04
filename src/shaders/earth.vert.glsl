// Earth surface vertex — passes a tangent frame for normal mapping on a UV sphere.
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vPosW;
varying vec3 vTangentW;
varying vec3 vBitangentW;

void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vPosW = wp.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  // Sphere tangent along longitude: derivative of position w.r.t. u
  vec3 t = normalize(vec3(-position.z, 0.0, position.x));
  vTangentW = normalize(mat3(modelMatrix) * t);
  vBitangentW = normalize(cross(vNormalW, vTangentW));
  gl_Position = projectionMatrix * viewMatrix * wp;
}
