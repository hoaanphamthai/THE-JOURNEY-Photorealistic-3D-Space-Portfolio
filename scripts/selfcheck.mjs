/**
 * Automated self-check script:
 * 1. Checks content.ts data integrity.
 * 2. Checks all texture and binary assets in public/ exist and have non-zero size.
 * 3. Verifies dist/ build artifacts exist and index.html is valid.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

console.log('Running self-check tests...');

// 0. settings.json check
const settingsPath = path.join(ROOT, 'settings.json');
assert(fs.existsSync(settingsPath), 'settings.json missing in project root');
const rawSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
assert(rawSettings.personal && rawSettings.personal.name, 'settings.json missing personal.name');
assert(Array.isArray(rawSettings.sections?.projects?.items), 'settings.json missing projects array');
assert(Array.isArray(rawSettings.sections?.skills?.items), 'settings.json missing skills array');
console.log(`✓ settings.json verified (Portfolio owner: ${rawSettings.personal.name}).`);

// 1. Assets check
const requiredAssets = [
  'public/assets/textures/earth/day.webp',
  'public/assets/textures/earth/night.webp',
  'public/assets/textures/earth/clouds.webp',
  'public/assets/textures/earth/specular.webp',
  'public/assets/textures/earth/normal.webp',
  'public/assets/textures/moon/albedo.webp',
  'public/assets/textures/moon/height.webp',
  'public/assets/textures/saturn/albedo.webp',
  'public/assets/textures/saturn/ring.webp',
  'public/assets/textures/sky/milkyway.webp',
  'public/assets/stars/stars.bin',
  'public/basis/basis_transcoder.wasm',
  'public/draco/draco_decoder.wasm',
];

for (const rel of requiredAssets) {
  const p = path.join(ROOT, rel);
  assert(fs.existsSync(p), `Missing required asset: ${rel}`);
  const st = fs.statSync(p);
  assert(st.size > 100, `Asset ${rel} is suspiciously small (${st.size} bytes)`);
}
console.log(`✓ All ${requiredAssets.length} static assets verified.`);

// 2. Stars binary check
const starsPath = path.join(ROOT, 'public/assets/stars/stars.bin');
const starsBuf = fs.readFileSync(starsPath);
const starCount = starsBuf.byteLength / 20; // 5 floats * 4 bytes
assert(starCount > 10000, `Expected >10000 catalog stars, got ${starCount}`);
console.log(`✓ Star catalogue binary holds ${starCount} stars.`);

// 3. Dist build verification
const distIndex = path.join(ROOT, 'dist/index.html');
assert(fs.existsSync(distIndex), 'dist/index.html missing. Run `npm run build` first.');
const distHtml = fs.readFileSync(distIndex, 'utf-8');
assert(distHtml.includes('<canvas id="gl"'), 'dist/index.html missing gl canvas');
assert(distHtml.includes('id="preloader"'), 'dist/index.html missing preloader markup');
console.log('✓ Production dist artifacts verified.');

console.log('\nAll self-check checks passed successfully.');
