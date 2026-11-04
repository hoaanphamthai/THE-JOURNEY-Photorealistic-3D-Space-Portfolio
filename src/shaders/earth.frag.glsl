// Earth surface: day/night blend across a soft terminator, ocean specular, city lights only on the dark side.
uniform sampler2D uDay;
uniform sampler2D uNight;
uniform sampler2D uSpecular; // white = water
uniform sampler2D uNormal;
uniform vec3 uSunDir;        // world space, towards the Sun
uniform float uExposure;

varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vPosW;
varying vec3 vTangentW;
varying vec3 vBitangentW;

void main() {
  // --- normal mapping (tangent frame built in vertex shader) ---
  vec3 nTex = texture2D(uNormal, vUv).xyz * 2.0 - 1.0;
  nTex.xy *= 0.6; // the SSS normal map is strong; soften for orbital distance
  vec3 N = normalize(vTangentW * nTex.x + vBitangentW * nTex.y + vNormalW * nTex.z);
  vec3 Ng = normalize(vNormalW);
  vec3 L = normalize(uSunDir);
  vec3 V = normalize(cameraPosition - vPosW);

  float NdotL = dot(Ng, L);              // geometric terminator (smooth)
  float day = smoothstep(-0.08, 0.22, NdotL);

  vec3 albedo = texture2D(uDay, vUv).rgb;
  float water = texture2D(uSpecular, vUv).r;

  // Lambert with normal-mapped detail only on land; water stays smooth
  float diff = max(dot(mix(Ng, N, 1.0 - water), L), 0.0);
  vec3 lit = albedo * diff;

  // Ocean sun glint: GGX-ish narrow specular, Fresnel on grazing angles
  vec3 H = normalize(L + V);
  float NdotH = max(dot(Ng, H), 0.0);
  float rough = mix(0.5, 0.2, water);   // open ocean is never mirror-smooth from orbit (waves)
  float a2 = rough * rough * rough * rough;
  float dn = (NdotH * NdotH * (a2 - 1.0) + 1.0);
  float D = a2 / (3.14159 * dn * dn);
  float F = 0.02 + 0.98 * pow(1.0 - max(dot(V, H), 0.0), 5.0);
  vec3 spec = vec3(D * F * 0.6) * water * smoothstep(0.0, 0.1, NdotL);

  // City lights: only where it is night, fading across the terminator
  vec3 night = texture2D(uNight, vUv).rgb;
  night = pow(night, vec3(1.4)) * 1.6;                 // crush low-level noise, keep bright cores
  float nightMask = 1.0 - smoothstep(-0.2, 0.05, NdotL);

  // Faint earthshine-free fill: real space is black, keep this ~0.5%
  vec3 color = (lit + spec) * uExposure + albedo * 0.005 + night * nightMask;

  // Atmospheric perspective at the limb seen through the air column (blue tint, very subtle)
  float rim = pow(1.0 - max(dot(Ng, V), 0.0), 3.0);
  color += vec3(0.25, 0.45, 0.9) * rim * 0.12 * day;

  gl_FragColor = vec4(color, 1.0);
}
