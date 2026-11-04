// Atmosphere shell (rendered on the BACK faces of a slightly larger sphere).
// Single-scattering approximation: Rayleigh (blue, λ^-4) + Mie (forward lobe) along the view ray,
// integrated analytically over a thin shell. Gives blue limb at day, orange at the terminator.
uniform vec3 uSunDir;
uniform float uPlanetRadius;
uniform float uAtmoRadius;
uniform float uIntensity;

varying vec3 vPosW;
varying vec3 vCenterW;

// Ray/sphere intersection, returns (near, far) or (-1,-1)
vec2 raySphere(vec3 ro, vec3 rd, vec3 c, float r) {
  vec3 oc = ro - c;
  float b = dot(oc, rd);
  float h = b * b - (dot(oc, oc) - r * r);
  if (h < 0.0) return vec2(-1.0);
  h = sqrt(h);
  return vec2(-b - h, -b + h);
}

void main() {
  vec3 ro = cameraPosition;
  vec3 rd = normalize(vPosW - ro);
  vec2 atmo = raySphere(ro, rd, vCenterW, uAtmoRadius);
  if (atmo.y < 0.0) discard;
  vec2 pl = raySphere(ro, rd, vCenterW, uPlanetRadius);
  float tStart = max(atmo.x, 0.0);
  float tEnd = (pl.x > 0.0) ? pl.x : atmo.y;   // stop at the ground
  if (tEnd <= tStart) discard;

  const int STEPS = 10;
  float dt = (tEnd - tStart) / float(STEPS);
  float H = (uAtmoRadius - uPlanetRadius) * 0.25; // scale height
  vec3 betaR = vec3(5.8e-3, 13.5e-3, 33.1e-3) * (1.0 / H) * 0.085; // Rayleigh, λ^-4 ratio
  float betaM = 4.0e-3 * (1.0 / H) * 0.085;

  vec3 L = normalize(uSunDir);
  float mu = dot(rd, L);
  float phaseR = 3.0 / (16.0 * 3.14159) * (1.0 + mu * mu);
  float g = 0.76;
  float phaseM = 3.0 / (8.0 * 3.14159) * ((1.0 - g * g) * (1.0 + mu * mu)) / ((2.0 + g * g) * pow(1.0 + g * g - 2.0 * g * mu, 1.5));

  vec3 sumR = vec3(0.0);
  float sumM = 0.0;
  float odR = 0.0, odM = 0.0; // optical depth along view

  for (int i = 0; i < STEPS; i++) {
    vec3 p = ro + rd * (tStart + (float(i) + 0.5) * dt);
    float h = length(p - vCenterW) - uPlanetRadius;
    float dens = exp(-h / H) * dt;
    odR += dens; odM += dens;
    // light optical depth: march towards the Sun (4 steps is enough for a thin shell)
    vec2 ls = raySphere(p, L, vCenterW, uAtmoRadius);
    vec2 lp = raySphere(p, L, vCenterW, uPlanetRadius);
    float lodR = 0.0;
    if (lp.x > 0.0) { lodR = 1e9; } // in the planet's shadow
    else {
      float ldt = ls.y / 4.0;
      for (int j = 0; j < 4; j++) {
        vec3 q = p + L * ((float(j) + 0.5) * ldt);
        lodR += exp(-(length(q - vCenterW) - uPlanetRadius) / H) * ldt;
      }
    }
    vec3 tau = betaR * (odR + lodR) + betaM * 1.1 * (odM + lodR);
    vec3 att = exp(-tau);
    sumR += dens * att;
    sumM += dens * att.g;
  }
  vec3 col = (sumR * betaR * phaseR + sumM * betaM * phaseM) * uIntensity * 60.0;
  // alpha from total optical depth so the limb stays transparent against the stars
  float alpha = clamp(1.0 - exp(-length(col) * 2.5), 0.0, 1.0);
  gl_FragColor = vec4(col, alpha);
}
