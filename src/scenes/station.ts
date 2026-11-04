/**
 * Orbital station. Loads /assets/models/station.glb if present (Draco/KTX2 supported);
 * otherwise builds a procedural ISS-style station: pressurised modules, integrated truss,
 * solar array wings, radiators, thermal foil, emissive windows. All PBR under the single Sun light.
 * Project panels are planes mounted on the modules; the camera path runs along the truss.
 */
import {
  Group, Mesh, CylinderGeometry, BoxGeometry, MeshStandardMaterial, MeshPhysicalMaterial, PlaneGeometry,
  ShaderMaterial, Vector3, Object3D, type Texture, CanvasTexture, SRGBColorSpace, LinearFilter,
  TorusGeometry, InstancedMesh, SphereGeometry,
} from 'three';
import quadVert from '../shaders/quad.vert.glsl';
import panelFrag from '../shaders/panel.frag.glsl';
import { STATION_POS, STATION_SCALE } from '../config/universe';
import { content, type Project } from '../config/content';
import type { Assets } from '../core/assets';

const _o = new Object3D();

export interface PanelRef {
  mesh: Mesh;
  mat: ShaderMaterial;
  project: Project;
  /** camera position / look target in world space for the zoom-in */
  camPos: Vector3;
  camLook: Vector3;
  hover: number;
}

/** Placeholder project image: dark panel with the title set in mono — used until real images exist. */
function placeholderImage(p: Project): Texture {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 640;
  const g = c.getContext('2d')!;
  const grd = g.createLinearGradient(0, 0, 1024, 640);
  grd.addColorStop(0, '#12151b'); grd.addColorStop(1, '#232a36');
  g.fillStyle = grd; g.fillRect(0, 0, 1024, 640);
  g.strokeStyle = 'rgba(242,239,233,0.12)'; g.lineWidth = 2;
  for (let x = 0; x < 1024; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 640); g.stroke(); }
  for (let y = 0; y < 640; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(1024, y); g.stroke(); }
  g.fillStyle = '#F2EFE9'; g.font = '600 56px Inter, system-ui, sans-serif';
  g.fillText(p.title, 64, 320);
  g.fillStyle = '#FFB86B'; g.font = '400 28px ui-monospace, monospace';
  g.fillText(`${p.year}  ·  ${p.category}`, 64, 380);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace; t.minFilter = LinearFilter;
  return t;
}

export class Station {
  group = new Group();
  panels: PanelRef[] = [];
  private disposables: { dispose(): void }[] = [];
  private arrays: Mesh[] = [];
  loaded = false;
  private loading: Promise<void> | null = null;

  constructor() {
    this.group.position.copy(STATION_POS);
    this.group.scale.setScalar(STATION_SCALE);
    this.group.rotation.set(0.06, -0.35, 0.08);
    this.buildProcedural();
    this.group.updateMatrixWorld(true);
  }

  private mat<T extends MeshStandardMaterial>(m: T) { this.disposables.push(m); return m; }
  private geo<T extends { dispose(): void }>(g: T) { this.disposables.push(g); return g; }

  /** ISS-like layout in "station units" (1 unit ≈ 10 m before STATION_SCALE). */
  private buildProcedural() {
    const foil = this.mat(new MeshStandardMaterial({ color: 0xf1ece2, roughness: 0.5, metalness: 0.15 })); // MLI blankets
    const alu = this.mat(new MeshStandardMaterial({ color: 0xd4d7db, roughness: 0.4, metalness: 0.75 }));
    const gold = this.mat(new MeshStandardMaterial({ color: 0xc9a24a, roughness: 0.3, metalness: 1.0 })); // kapton gold
    const dark = this.mat(new MeshStandardMaterial({ color: 0x2a2d31, roughness: 0.8, metalness: 0.4 }));
    const cell = this.mat(new MeshPhysicalMaterial({ color: 0x2b3d63, roughness: 0.3, metalness: 0.45, clearcoat: 1, clearcoatRoughness: 0.12 }));
    const radiator = this.mat(new MeshStandardMaterial({ color: 0xf4f4f2, roughness: 0.6, metalness: 0.1 }));
    const window = this.mat(new MeshStandardMaterial({ color: 0x0a0c10, roughness: 0.1, metalness: 0.2, emissive: 0xffe3b8, emissiveIntensity: 2.4 }));

    const add = (m: Mesh) => { m.castShadow = m.receiveShadow = true; this.group.add(m); return m; };

    // --- main truss along X ---
    const trussGeo = this.geo(new BoxGeometry(11, 0.45, 0.45));
    add(new Mesh(trussGeo, alu));
    const strutGeo = this.geo(new CylinderGeometry(0.03, 0.03, 0.6, 6));
    const struts = new InstancedMesh(strutGeo, alu, 40);
    for (let i = 0; i < 40; i++) {
      _o.position.set(-5.2 + (i % 20) * 0.55, 0, i < 20 ? 0.22 : -0.22);
      _o.rotation.set(0, 0, i % 2 ? 0.8 : -0.8);
      _o.updateMatrix(); struts.setMatrixAt(i, _o.matrix);
    }
    struts.castShadow = struts.receiveShadow = true;
    this.group.add(struts); this.disposables.push(struts);

    // --- pressurised modules along Z (perpendicular to the truss) ---
    const modGeo = this.geo(new CylinderGeometry(0.42, 0.42, 1.9, 32));
    modGeo.rotateX(Math.PI / 2);
    const ringGeo = this.geo(new TorusGeometry(0.43, 0.035, 8, 32));
    const nodeGeo = this.geo(new SphereGeometry(0.5, 24, 16));
    const modules = [-2.2, -0.2, 1.8, 3.8];
    modules.forEach((z, i) => {
      const m = add(new Mesh(modGeo, i % 2 ? foil : alu));
      m.position.set(0, -0.25, z);
      [-0.6, 0.6].forEach((dz) => { const r = add(new Mesh(ringGeo, dark)); r.position.set(0, -0.25, z + dz); });
    });
    const node = add(new Mesh(nodeGeo, foil)); node.position.set(0, -0.25, 0.8);
    const lab = add(new Mesh(modGeo, gold)); lab.position.set(1.6, -0.25, 0.8); lab.rotation.y = Math.PI / 2;
    const lab2 = add(new Mesh(modGeo, alu)); lab2.position.set(-1.6, -0.25, 0.8); lab2.rotation.y = Math.PI / 2;

    // --- windows (small emissive panes on modules) ---
    const winGeo = this.geo(new PlaneGeometry(0.12, 0.08));
    const wins = new InstancedMesh(winGeo, window, 24);
    for (let i = 0; i < 24; i++) {
      const z = modules[i % 4] + ((i >> 2) % 3 - 1) * 0.5;
      const side = i % 2 ? 1 : -1;
      _o.position.set(side * 0.421, -0.25 + ((i >> 3) - 1) * 0.12, z);
      _o.rotation.set(0, side * Math.PI / 2, 0);
      _o.updateMatrix(); wins.setMatrixAt(i, _o.matrix);
    }
    this.group.add(wins); this.disposables.push(wins);

    // --- solar array wings (4 pairs) ---
    const wingGeo = this.geo(new BoxGeometry(0.04, 3.4, 1.1));
    const mastGeo = this.geo(new CylinderGeometry(0.05, 0.05, 3.6, 8));
    [-4.6, -3.2, 3.2, 4.6].forEach((x) => {
      [1, -1].forEach((dir) => {
        const w = add(new Mesh(wingGeo, cell));
        w.position.set(x, dir * 2.0, 0);
        this.arrays.push(w);
        const m = add(new Mesh(mastGeo, alu)); m.position.set(x, dir * 2.0, 0);
      });
    });

    // --- radiators (white, fold out from the truss) ---
    const radGeo = this.geo(new BoxGeometry(1.6, 0.03, 0.7));
    [-1.2, 1.2].forEach((x) => { const r = add(new Mesh(radGeo, radiator)); r.position.set(x, -0.9, -1.2); r.rotation.x = 0.4; });

    // --- project panels on the module flanks ---
    const panelGeo = this.geo(new PlaneGeometry(1.0, 0.625));
    content.projects.forEach((p, i) => {
      const mat = new ShaderMaterial({
        vertexShader: quadVert, fragmentShader: panelFrag,
        uniforms: { uMap: { value: placeholderImage(p) }, uHover: { value: 0 }, uTime: { value: 0 }, uMouse: { value: { x: 0.5, y: 0.5 } } },
      });
      this.disposables.push(mat);
      const mesh = new Mesh(panelGeo, mat);
      const z = modules[i % modules.length];
      const side = 1; // all panels on the +X flank, the side the camera path runs along
      mesh.position.set(side * 0.55, 0.05, z);
      mesh.rotation.y = side * Math.PI / 2;
      mesh.userData.panelIndex = i;
      this.group.add(mesh);
      // camera framing: 1.1 units out along the panel normal, in local space → converted later
      const camPos = new Vector3(side * 1.35, 0.05, z);
      const camLook = new Vector3(side * 0.55, 0.05, z);
      this.panels.push({ mesh, mat, project: p, camPos, camLook, hover: 0 });
    });
    this.group.updateMatrixWorld(true);
    this.panels.forEach((p) => { p.camPos.applyMatrix4(this.group.matrixWorld); p.camLook.applyMatrix4(this.group.matrixWorld); });
  }

  /** Optional real model: replaces the procedural hull but keeps the panels. */
  load(assets: Assets, onProgress?: (p: number) => void) {
    if (this.loading) return this.loading;
    this.loading = assets.model('/assets/models/station.glb', onProgress)
      .then((gltf) => {
        gltf.scene.traverse((o) => { if ((o as Mesh).isMesh) { o.castShadow = o.receiveShadow = true; } });
        this.group.add(gltf.scene);
        // hide procedural hull (everything that is not a panel)
        this.group.children.forEach((c) => { if (c !== gltf.scene && c.userData.panelIndex === undefined) c.visible = false; });
      })
      .catch(() => { /* no model shipped: procedural station stays */ })
      .then(() => { this.loaded = true; });
    // project images stream independently
    this.panels.forEach((p) => {
      assets.texture(p.project.image).then((t) => { p.mat.uniforms.uMap.value = t; }).catch(() => {});
    });
    return this.loading;
  }

  update(dt: number, elapsed: number) {
    // arrays track the Sun very slowly (real SARJ rotates once per orbit)
    for (const a of this.arrays) a.rotation.y = Math.sin(elapsed * 0.02) * 0.3;
    for (const p of this.panels) {
      p.mat.uniforms.uTime.value = elapsed;
      const u = p.mat.uniforms.uHover;
      u.value += (p.hover - u.value) * (1 - Math.exp(-10 * dt));
    }
  }

  distanceTo(p: Vector3) {
    return p.distanceTo(this.group.position);
  }

  dispose() {
    this.disposables.forEach((d) => d.dispose());
  }
}
