/** Frame-rate independent exponential smoothing (Freya Holmér style). */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const inverseLerp = (a: number, b: number, v: number) => clamp((v - a) / (b - a), 0, 1);
export const smoothstep = (a: number, b: number, v: number) => {
  const t = inverseLerp(a, b, v);
  return t * t * (3 - 2 * t);
};

/** B-V colour index → approximate linear RGB (Ballesteros blackbody fit, then simple CIE-ish mapping). */
export function bvToRGB(bv: number): [number, number, number] {
  const t = 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62)); // Kelvin
  // Tanner Helland temperature → RGB approximation, in 0..1
  const T = clamp(t, 1000, 40000) / 100;
  let r: number, g: number, b: number;
  if (T <= 66) {
    r = 1;
    g = clamp((99.47 * Math.log(T) - 161.12) / 255, 0, 1);
    b = T <= 19 ? 0 : clamp((138.52 * Math.log(T - 10) - 305.04) / 255, 0, 1);
  } else {
    r = clamp((329.7 * Math.pow(T - 60, -0.1332)) / 255, 0, 1);
    g = clamp((288.12 * Math.pow(T - 60, -0.0755)) / 255, 0, 1);
    b = 1;
  }
  return [r, g, b];
}
