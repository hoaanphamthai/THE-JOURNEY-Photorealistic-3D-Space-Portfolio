/**
 * World layout. Unit: 1 = Earth radius (6371 km).
 * Body radii are real relative sizes. Distances are compressed (see README → Scale)
 * because real distances would put Saturn 220,000 units away.
 */
import { Vector3 } from 'three';

export const EARTH_RADIUS = 1;
export const MOON_RADIUS = 0.2727;
export const SATURN_RADIUS = 9.45;
export const RING_INNER = 1.24 * SATURN_RADIUS; // C ring inner edge
export const RING_OUTER = 2.27 * SATURN_RADIUS; // A ring outer edge
export const SATURN_TILT = (26.73 * Math.PI) / 180;

/** Fixed Sun direction (towards the Sun). One directional light, everything is lit from here. */
export const SUN_DIR = new Vector3(-0.85, 0.2, 0.45).normalize();
export const SUN_DISTANCE = 4000; // where the visible Sun disc is drawn (always relative to camera)
export const SUN_ANGULAR_RADIUS = 0.00465; // rad, real ≈ 0.266°
/** Camera-right when looking straight at the Sun (forward × up). */
export const SUN_RIGHT = new Vector3().crossVectors(SUN_DIR, new Vector3(0, 1, 0)).normalize();

export const EARTH_POS = new Vector3(0, 0, 0);
export const MOON_POS = new Vector3(-14, 2.5, -18); // real: 60 R⊕; compressed ×0.38
export const STATION_POS = new Vector3(2.6, 0.6, 0.9); // ISS orbit compressed; station scaled ×900 to be visible
export const STATION_SCALE = 0.09; // whole station ≈ 0.09 units long
export const SATURN_POS = new Vector3(-380, 40, -560); // real: 220,000 R⊕

/** Real-world telemetry anchors per section (km from Earth's centre), interpolated in log space. */
export const TELEMETRY = [
  { t: 0.0, km: 6771, label: 'Low Earth orbit' },
  { t: 0.2, km: 384_400, label: 'Cislunar transfer' },
  { t: 0.3, km: 386_000, label: 'Lunar flyby' },
  { t: 0.48, km: 6779, label: 'Station approach' },
  { t: 0.68, km: 1_275_000_000, label: 'Saturn arrival' },
  { t: 1.0, km: 1_426_000_000, label: 'Deep space' },
];

export interface CameraKey {
  t: number; // scroll progress 0..1
  pos: Vector3;
  look: Vector3;
  fov?: number;
}

const m = (x: number, y: number, z: number) => MOON_POS.clone().add(new Vector3(x, y, z));
const TO_EARTH = MOON_POS.clone().negate().normalize();
const MOON_UP = new Vector3(0, 1, 0).addScaledVector(TO_EARTH, -TO_EARTH.y).normalize(); // "up" ⟂ Earth direction
// 0.03 R⊕ (~190 km) above the lunar surface: horizon dips ~25°, Earth sits ~12° above it
const EARTHRISE_CAM = MOON_POS.clone().addScaledVector(MOON_UP, MOON_RADIUS + 0.03);
const s = (x: number, y: number, z: number) => STATION_POS.clone().add(new Vector3(x, y, z));
const sat = (x: number, y: number, z: number) => SATURN_POS.clone().add(new Vector3(x, y, z));

export const CAMERA_KEYS: CameraKey[] = [
  // 01 Earth orbit — limb on the right, text column free on the left
  { t: 0.0, pos: new Vector3(0.9, 0.35, 2.9), look: new Vector3(-0.55, -0.05, 0), fov: 42 },
  { t: 0.1, pos: new Vector3(0.6, 0.7, 2.4), look: new Vector3(-0.45, 0.1, 0), fov: 42 },
  // 02 Moon — approach, low pass, then Earth rises over the limb
  { t: 0.2, pos: m(1.6, 0.6, 2.2), look: MOON_POS.clone(), fov: 40 },
  { t: 0.3, pos: m(0.26, 0.12, 0.46), look: m(-0.12, 0.02, 0), fov: 40 },
  // Earthrise: camera skims the lunar surface on the Earth-facing terminator, looking "ahead" towards Earth
  { t: 0.38, pos: EARTHRISE_CAM, look: EARTHRISE_CAM.clone().addScaledVector(TO_EARTH, 1).addScaledVector(MOON_UP, -0.12), fov: 30 },
  { t: 0.44, pos: new Vector3(-3.2, 1.6, 2.6), look: new Vector3(1.4, 0.4, 0.9), fov: 40 },
  // 03 Station — slide along the truss, modules on the right
  { t: 0.5, pos: s(0.44, 0.11, 0.24), look: s(0, 0, 0.1), fov: 38 },
  { t: 0.6, pos: s(0.3, 0.04, -0.12), look: s(0, -0.01, 0.0), fov: 38 },
  // 04 Saturn — arrival from above the ring plane, then under the rings
  { t: 0.7, pos: sat(34, 16, 46), look: sat(-4, 0, 0), fov: 40 },
  { t: 0.8, pos: sat(-20, 10, 40), look: sat(-6, 1, 0), fov: 40 },
  { t: 0.88, pos: sat(-64, 24, 60), look: sat(-6, 0, 0), fov: 42 },
  // 05 Deep space — turn to face the Sun, planet slips out of frame to the right
  // aim slightly left/below the Sun so the disc sits upper-right, clear of the centred copy
  { t: 1.0, pos: sat(-96, 30, 92), look: sat(-96, 30, 92).addScaledVector(SUN_DIR, 10).addScaledVector(SUN_RIGHT, -4.5).add(new Vector3(0, -2.6, 0)), fov: 46 },
];

export const SECTIONS = [
  // Ranges mirror the DOM section heights in style.css (170 / 230 / 230 / 230 / 150 vh)
  { id: 'hero', label: 'Earth orbit', from: 0.0, to: 0.17 },
  { id: 'about', label: 'Moon', from: 0.17, to: 0.44 },
  { id: 'projects', label: 'Station', from: 0.44, to: 0.69 },
  { id: 'skills', label: 'Saturn', from: 0.69, to: 0.94 },
  { id: 'contact', label: 'Deep space', from: 0.94, to: 1.01 },
] as const;

export type SectionId = (typeof SECTIONS)[number]['id'];

export function sectionIndexAt(t: number): number {
  for (let i = SECTIONS.length - 1; i >= 0; i--) if (t >= SECTIONS[i].from) return i;
  return 0;
}
