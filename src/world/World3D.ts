import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { config } from '../config';
import { ModelResources } from '../core/assets';
import { Ease, tweens } from '../core/tween';
import { clamp, rand } from '../core/utils';

export type PassId = 'walls' | 'roof';

export interface Debris {
  obj: THREE.Object3D;
  flat: boolean;
  alive: boolean;
  scale: number;
}

interface PaintPass {
  lo: number;
  hi: number;
  painted: THREE.MeshLambertMaterial[];
  unpainted: THREE.MeshLambertMaterial[];
  tint: THREE.MeshLambertMaterial;
  paintedPlanes: [THREE.Plane, THREE.Plane];
  unpaintedPlanes: [THREE.Plane, THREE.Plane];
  box: THREE.Box3;
}

const DEBRIS_LAYOUT: [string, number, number, number, number][] = [
  // model, x, z, rotationY (deg), scale
  ['debris_tire', 2.45, 2.75, 20, 1.0],
  ['debris_box', -2.75, 2.4, -25, 1.05],
  ['debris_rock_a', 3.05, 0.85, 40, 1.1],
  ['debris_rock_b', -3.0, 0.2, 10, 1.1],
  ['debris_planks', 0.8, 3.1, -15, 1.0],
  ['debris_bricks', -1.75, 3.55, 25, 1.1],
  ['debris_bag', 1.95, 4.0, 0, 1.05],
  ['debris_barrel', -2.9, 4.0, 60, 0.95],
  ['debris_can', 0.95, 4.55, 30, 1.3],
  ['debris_mud', -0.35, 4.3, 15, 1.0],
  ['debris_mud', 2.75, 1.8, -40, 0.8],
  ['debris_weeds', 3.2, -0.7, 0, 1.2],
  ['debris_weeds', -2.45, 1.4, 30, 1.0],
  ['debris_rock_a', 0.3, 2.2, -60, 0.7],
  ['debris_tire', -1.15, 4.85, 100, 0.85]
];

const SCENERY: [string, number, number, number, number][] = [
  ['tree_round', -5.4, -2.6, 0, 1.15],
  ['tree_round', 5.3, -1.4, 70, 1.0],
  ['tree_pine', 4.6, -4.4, 0, 1.2],
  ['tree_pine', -3.2, -5.2, 20, 1.0],
  ['tree_round', -7.2, 2.2, 140, 1.1],
  ['tree_round', 7.4, 3.2, 30, 1.2],
  ['bush', 3.7, -2.5, 0, 1.0],
  ['bush', -4.1, -0.3, 60, 0.9],
  ['bush', 5.0, 1.6, 120, 1.1],
  ['bush', -5.3, 3.8, 10, 1.0],
  ['fence', -4.0, -3.9, 0, 1],
  ['fence', -2.0, -3.9, 0, 1],
  ['fence', 0.0, -3.9, 0, 1],
  ['fence', 2.0, -3.9, 0, 1],
  ['fence', 4.0, -3.9, 0, 1],
  ['fence', -5.0, -2.9, 90, 1],
  ['fence', -5.0, -0.9, 90, 1],
  ['fence', 5.0, -2.9, 90, 1],
  ['fence', 5.0, -0.9, 90, 1]
];

const FLOWERS: [number, number][] = [
  [-2.35, 2.05], [1.9, 2.1], [2.55, 0.9], [-2.6, -0.6], [0.2, 2.4], [-2.1, 3.4], [2.5, 3.3], [3.0, -1.5], [-0.1, 3.8],
  [1.4, 4.6], [-3.1, 2.2], [3.4, 2.4]
];

export class World3D {
  public readonly renderer: THREE.WebGLRenderer;
  public readonly scene = new THREE.Scene();
  public readonly camera: THREE.PerspectiveCamera;
  public debris: Debris[] = [];
  public width = 1;
  public height = 1;

  private models: Record<string, THREE.Object3D> = {};
  private shared: THREE.MeshLambertMaterial;
  private atlas: THREE.Texture;
  private broken: THREE.Object3D;
  private unpainted: THREE.Object3D;
  private painted: THREE.Object3D;
  private houseRoot = new THREE.Group();
  private flowers: THREE.Object3D[] = [];
  private sway: { obj: THREE.Object3D; phase: number; amp: number }[] = [];
  private clouds: THREE.Object3D[] = [];
  private passes = {} as Record<PassId, PaintPass>;
  private right = new THREE.Vector3(1, 0, 0);
  private towardCam = new THREE.Vector3(0, 0, 1);
  private sMin = -3;
  private sMax = 3;
  private raycaster = new THREE.Raycaster();
  private tmp = new THREE.Vector3();
  private time = 0;

  private target = new THREE.Vector3(...config.camera.target);
  private baseDir = new THREE.Vector3(...config.camera.direction).normalize();
  public view = { radius: config.camera.fitRadius, zoom: 1, orbit: 0, orbiting: false, top: 0, bottom: 0 };
  private orbitT = 0;
  private orbitAmp = { v: 0 };
  private shake = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.localClippingEnabled = true;

    this.camera = new THREE.PerspectiveCamera(config.camera.fov, 1, 0.5, 160);
    const horizon = 0xd6efff;
    this.scene.fog = new THREE.Fog(horizon, 24, 70);
    this.scene.add(this.makeSky(horizon));
    const far = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: 0x74c94e })
    );
    far.position.y = -0.02;
    far.receiveShadow = true;
    this.scene.add(far);

    // Strong sky fill + a soft key light from the camera side keeps the flat atlas colors vivid
    const hemi = new THREE.HemisphereLight(0xffffff, 0x9fb58a, 2.2);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff4e0, 1.7);
    sun.position.set(-6, 8, 8.8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const sc = sun.shadow.camera;
    sc.left = -10;
    sc.right = 10;
    sc.top = 10;
    sc.bottom = -10;
    sc.near = 1;
    sc.far = 40;
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun);
    this.scene.add(this.houseRoot);
  }

  private makeSky(horizon: number): THREE.Mesh {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        top: { value: new THREE.Color(0x3f9ff0) },
        mid: { value: new THREE.Color(0x92d1fb) },
        bottom: { value: new THREE.Color(horizon) }
      },
      vertexShader: `
        varying vec3 vPos;
        void main() {
          vPos = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * viewMatrix * vec4(vPos, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 top;
        uniform vec3 mid;
        uniform vec3 bottom;
        varying vec3 vPos;
        void main() {
          float h = normalize(vPos - cameraPosition).y;
          vec3 c = mix(bottom, mid, smoothstep(-0.01, 0.16, h));
          c = mix(c, top, smoothstep(0.16, 0.55, h));
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(140, 24, 12), mat);
    sky.renderOrder = -1;
    sky.frustumCulled = false;
    return sky;
  }

  async load(): Promise<void> {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const entries = Object.entries(ModelResources);
    const results = await Promise.all(entries.map(([, uri]) => loader.loadAsync(uri)));
    entries.forEach(([key], i) => (this.models[key] = results[i].scene));

    this.models.ground.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && !this.atlas) this.atlas = (m.material as THREE.MeshStandardMaterial).map as THREE.Texture;
    });
    this.atlas.magFilter = THREE.NearestFilter;
    this.atlas.minFilter = THREE.NearestFilter;
    this.atlas.generateMipmaps = false;
    this.atlas.colorSpace = THREE.SRGBColorSpace;
    this.atlas.needsUpdate = true;
    this.shared = new THREE.MeshLambertMaterial({ map: this.atlas });

    for (const key in this.models) {
      this.models[key].traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        const old = m.material as THREE.Material;
        m.material = this.shared;
        if (old !== this.shared) old.dispose();
        m.castShadow = key !== 'ground' && key !== 'debris_mud' && key !== 'cloud';
        m.receiveShadow = key === 'ground' || key.startsWith('house');
      });
    }
    this.build();
  }

  private clone(key: string, x: number, z: number, rotY = 0, scale = 1): THREE.Object3D {
    const o = this.models[key].clone(true);
    o.position.set(x, 0, z);
    o.rotation.y = THREE.MathUtils.degToRad(rotY);
    o.scale.setScalar(scale);
    this.scene.add(o);
    return o;
  }

  private build(): void {
    this.scene.add(this.models.ground);
    this.broken = this.models.house_broken;
    this.unpainted = this.models.house_unpainted;
    this.painted = this.models.house_painted;
    this.houseRoot.add(this.broken, this.unpainted, this.painted);
    this.unpainted.visible = false;
    this.painted.visible = false;

    for (const [key, x, z, r, s] of SCENERY) {
      const o = this.clone(key, x, z, r, s);
      if (key !== 'fence') this.sway.push({ obj: o, phase: Math.random() * 6, amp: key === 'bush' ? 0.02 : 0.025 });
    }
    const cloudMat = new THREE.MeshLambertMaterial({ map: this.atlas, fog: false, emissive: 0x9fb3c8, emissiveIntensity: 0.55 });
    for (let i = 0; i < 5; i++) {
      const c = this.clone('cloud', -22 + i * 11 + rand(-2, 2), -30 - rand(0, 6), rand(0, 360), rand(1.6, 2.4));
      c.position.y = rand(6, 10);
      c.traverse((o) => ((o as THREE.Mesh).isMesh ? ((o as THREE.Mesh).material = cloudMat) : null));
      this.clouds.push(c);
    }
    for (const [key, x, z, r, s] of DEBRIS_LAYOUT) {
      const o = this.clone(key, x, z, r, s);
      this.debris.push({ obj: o, flat: key === 'debris_mud', alive: true, scale: s });
    }
    for (const [x, z] of FLOWERS) {
      const f = this.clone('flowers', x, z, rand(0, 360), 0.001);
      f.visible = false;
      this.flowers.push(f);
    }
    this.scene.updateMatrixWorld(true);
    this.setupPaint();
  }

  private setupPaint(): void {
    const mk = (color = 0xffffff) => {
      const m = new THREE.MeshLambertMaterial({ map: this.atlas, color });
      m.clipShadows = true;
      return m;
    };
    const find = (root: THREE.Object3D, name: string) => root.getObjectByName(name) as THREE.Mesh;
    const groups: Record<PassId, string[]> = { walls: ['walls', 'trim'], roof: ['roof', 'roof_trim'] };
    for (const id of ['walls', 'roof'] as PassId[]) {
      const tint = mk(0xffffff);
      const painted: THREE.MeshLambertMaterial[] = [];
      const unpainted: THREE.MeshLambertMaterial[] = [];
      const box = new THREE.Box3();
      for (const part of groups[id]) {
        const pm = part === 'walls' || part === 'roof' ? tint : mk();
        find(this.painted, 'painted_' + part).material = pm;
        if (!painted.includes(pm)) painted.push(pm);
        const um = mk();
        um.clipIntersection = true;
        find(this.unpainted, 'unpainted_' + part).material = um;
        unpainted.push(um);
        box.expandByObject(find(this.painted, 'painted_' + part));
      }
      const pass: PaintPass = {
        lo: 1e3,
        hi: -1e3,
        painted,
        unpainted,
        tint,
        paintedPlanes: [new THREE.Plane(), new THREE.Plane()],
        unpaintedPlanes: [new THREE.Plane(), new THREE.Plane()],
        box
      };
      painted.forEach((m) => (m.clippingPlanes = pass.paintedPlanes));
      unpainted.forEach((m) => (m.clippingPlanes = pass.unpaintedPlanes));
      this.passes[id] = pass;
      this.applyPass(pass);
    }
  }

  private applyPass(p: PaintPass): void {
    const r = this.right;
    p.paintedPlanes[0].normal.copy(r);
    p.paintedPlanes[0].constant = -p.lo;
    p.paintedPlanes[1].normal.copy(r).negate();
    p.paintedPlanes[1].constant = p.hi;
    p.unpaintedPlanes[0].normal.copy(r).negate();
    p.unpaintedPlanes[0].constant = p.lo;
    p.unpaintedPlanes[1].normal.copy(r);
    p.unpaintedPlanes[1].constant = -p.hi;
  }

  // ------------------------------------------------------------------ camera

  resize(width: number, height: number, top: number, bottom: number): void {
    this.width = width;
    this.height = height;
    this.view.top = top;
    this.view.bottom = bottom;
    this.renderer.setSize(width, height, false);
    const aspect = width / height;
    this.camera.aspect = aspect;
    const hfov = THREE.MathUtils.degToRad(config.camera.fov);
    const vfov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(hfov / 2) / aspect));
    this.camera.fov = clamp(vfov, config.camera.fov, config.camera.maxFov);
    this.updateCamera();
  }

  private updateCamera(): void {
    const { width: w, height: h } = this;
    const v = this.view;
    const cam = this.camera;
    const regionH = Math.max(80, h - v.top - v.bottom);
    const half = THREE.MathUtils.degToRad(cam.fov / 2);
    const tanV = Math.tan(half) * (regionH / h);
    const tanH = Math.tan(half) * cam.aspect * 0.96;
    const t = Math.min(tanV, tanH);
    const k = cam.aspect > 1.2 ? config.camera.landscapeZoom : 1;
    const dist = (v.radius * v.zoom * k) / Math.sin(Math.atan(t));
    const dir = this.tmp.copy(this.baseDir).applyAxisAngle(THREE.Object3D.DEFAULT_UP, v.orbit);
    dir.x += Math.sin(this.time * 0.35) * 0.012;
    dir.y += Math.sin(this.time * 0.27) * 0.008;
    cam.position.copy(this.target).addScaledVector(dir.normalize(), dist);
    if (this.shake > 0.001) {
      cam.position.x += rand(-1, 1) * this.shake;
      cam.position.y += rand(-1, 1) * this.shake;
    }
    cam.lookAt(this.target);
    const d = (v.top - v.bottom) / 2;
    cam.setViewOffset(w, h, 0, -d, w, h);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
  }

  shakeCamera(amount = 0.12): void {
    this.shake = amount;
  }

  zoomPunch(amount = 0.06, duration = 700): void {
    tweens.kill(this.view);
    this.view.zoom = 1 - amount;
    tweens.to(this.view, { zoom: 1 }, duration, Ease.elasticOutSoft);
  }

  frameEndcard(top: number, bottom: number): void {
    tweens.to(this.view, { top, bottom, radius: config.camera.endcardRadius }, 1200, Ease.sineInOut);
    this.view.orbiting = true;
    tweens.to(this.orbitAmp, { v: config.camera.orbitSwing }, 1600, Ease.sineInOut);
  }

  // ------------------------------------------------------------------ queries

  toScreen(v: THREE.Vector3): { x: number; y: number } {
    const p = this.tmp.copy(v).project(this.camera);
    return { x: ((p.x + 1) / 2) * this.width, y: ((1 - p.y) / 2) * this.height };
  }

  private ray(x: number, y: number): THREE.Ray {
    this.raycaster.setFromCamera(new THREE.Vector2((x / this.width) * 2 - 1, -(y / this.height) * 2 + 1), this.camera);
    return this.raycaster.ray;
  }

  groundPoint(x: number, y: number): THREE.Vector3 | null {
    const out = new THREE.Vector3();
    return this.ray(x, y).intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), out);
  }

  houseScreenCenter(): { x: number; y: number } {
    return this.toScreen(new THREE.Vector3(0, 2.0, 0));
  }

  houseScreenRect(pass?: PassId): { x0: number; y0: number; x1: number; y1: number } {
    const box = pass ? this.passes[pass].box : new THREE.Box3().setFromObject(this.houseRoot);
    let x0 = 1e9;
    let y0 = 1e9;
    let x1 = -1e9;
    let y1 = -1e9;
    for (let i = 0; i < 8; i++) {
      const c = new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z);
      const s = this.toScreen(c);
      x0 = Math.min(x0, s.x);
      y0 = Math.min(y0, s.y);
      x1 = Math.max(x1, s.x);
      y1 = Math.max(y1, s.y);
    }
    return { x0, y0, x1, y1 };
  }

  debrisScreen(d: Debris): { x: number; y: number } {
    return this.toScreen(d.obj.position.clone().setY(d.flat ? 0 : 0.25));
  }

  // ------------------------------------------------------------------ cleaning

  introDebris(): void {
    this.debris.forEach((d, i) => {
      const s = d.obj.scale;
      s.setScalar(0.001);
      tweens.to(s, { x: d.scale * 1.25, z: d.scale * 1.25, y: d.scale * 0.6 }, 140, Ease.quadOut, 120 + i * 45);
      tweens.to(s, { x: d.scale, y: d.scale, z: d.scale }, 520, Ease.elasticOut, 260 + i * 45);
    });
  }

  /** Screen-space direction -> world ground direction. */
  private screenDirToWorld(dx: number, dy: number): THREE.Vector3 {
    const v = new THREE.Vector3().addScaledVector(this.right, dx).addScaledVector(this.towardCam, dy);
    v.y = 0;
    if (v.lengthSq() < 1e-6) v.set(rand(-1, 1), 0, 1);
    return v.normalize();
  }

  sweep(d: Debris, dx: number, dy: number): void {
    d.alive = false;
    const o = d.obj;
    const s = o.scale;
    const base = d.scale;
    tweens.kill(s);
    if (d.flat) {
      tweens.to(s, { x: base * 1.25, z: base * 0.75 }, 90, Ease.quadOut);
      tweens.to(s, { x: 0.001, y: 0.001, z: 0.001 }, 380, Ease.backIn, 90).onComplete(() => (o.visible = false));
      tweens.to(o.rotation, { y: o.rotation.y + rand(1.5, 2.5) }, 470, Ease.quadIn);
      return;
    }
    const dir = this.screenDirToWorld(dx, dy);
    const away = o.position.clone().setY(0).normalize();
    dir.addScaledVector(away, 0.6).normalize();
    const start = o.position.clone();
    const dist = rand(4.5, 6.5);
    const up = rand(2.2, 3.2);
    const spinX = rand(-9, 9);
    const spinZ = rand(-9, 9);
    const r0 = o.rotation.clone();
    s.set(base * 1.3, base * 0.65, base * 1.3);
    tweens.to(s, { x: base * 0.8, y: base * 1.35, z: base * 0.8 }, 110, Ease.quadOut, 60);
    tweens.to(s, { x: base, y: base, z: base }, 240, Ease.quadOut, 170);
    tweens.to(s, { x: 0.001, y: 0.001, z: 0.001 }, 260, Ease.quadIn, 520);
    tweens
      .run(
        780,
        Ease.linear,
        (t) => {
          const k = Math.max(0, (t * 780 - 60) / 720);
          o.position.set(start.x + dir.x * dist * k, start.y + up * 4 * k * (1 - k) * 1.1, start.z + dir.z * dist * k);
          o.rotation.set(r0.x + spinX * k, r0.y, r0.z + spinZ * k);
        },
        0
      )
      .onComplete(() => (o.visible = false));
  }

  aliveDebris(): Debris[] {
    return this.debris.filter((d) => d.alive);
  }

  squashHouse(): Promise<void> {
    const s = this.houseRoot.scale;
    tweens.kill(s);
    tweens.to(s, { x: 1.08, y: 0.84, z: 1.08 }, 200, Ease.quadOut);
    return tweens.wait(200);
  }

  swapToUnpainted(): void {
    this.broken.visible = false;
    this.unpainted.visible = true;
    this.popHouse();
  }

  popHouse(strength = 1): void {
    const s = this.houseRoot.scale;
    tweens.kill(s);
    s.set(1 - 0.12 * strength, 1 + 0.22 * strength, 1 - 0.12 * strength);
    tweens.to(s, { x: 1, y: 1, z: 1 }, 900, Ease.elasticOut);
    this.sway.forEach((t) => (t.amp = Math.max(t.amp, 0.09)));
  }

  wobbleHouse(): void {
    const s = this.houseRoot.scale;
    tweens.kill(s);
    s.set(1.06, 0.93, 1.06);
    tweens.to(s, { x: 1, y: 1, z: 1 }, 700, Ease.elasticOut);
  }

  // ------------------------------------------------------------------ painting

  beginPaint(id: PassId, color: number): void {
    this.painted.visible = true;
    this.camera.updateMatrixWorld();
    this.right.set(1, 0, 0).applyQuaternion(this.camera.quaternion).setY(0).normalize();
    this.towardCam.copy(this.camera.position).sub(this.target).setY(0).normalize();
    const box = this.passes[id].box;
    let mn = 1e9;
    let mx = -1e9;
    for (let i = 0; i < 8; i++) {
      const c = new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z);
      const s = c.dot(this.right);
      mn = Math.min(mn, s);
      mx = Math.max(mx, s);
    }
    this.sMin = mn - 0.05;
    this.sMax = mx + 0.05;
    for (const pid of ['walls', 'roof'] as PassId[]) this.applyPass(this.passes[pid]);
    this.setPaintColor(id, color);
  }

  setPaintColor(id: PassId, color: number): void {
    this.passes[id].tint.color.setHex(color);
  }

  /** Screen point -> coordinate along the paint axis. */
  paintCoord(x: number, y: number): number {
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(this.towardCam, new THREE.Vector3(0, 1.8, 0));
    const hit = this.ray(x, y).intersectPlane(plane, new THREE.Vector3());
    return hit ? hit.dot(this.right) : 0;
  }

  paintAt(id: PassId, s: number): number {
    const p = this.passes[id];
    const h = config.game.brushHalfWidth;
    p.lo = Math.min(p.lo, s - h);
    p.hi = Math.max(p.hi, s + h);
    this.applyPass(p);
    return this.paintProgress(id);
  }

  paintProgress(id: PassId): number {
    const p = this.passes[id];
    if (p.hi < p.lo) return 0;
    const lo = clamp(p.lo, this.sMin, this.sMax);
    const hi = clamp(p.hi, this.sMin, this.sMax);
    return clamp((hi - lo) / (this.sMax - this.sMin), 0, 1);
  }

  /** Sweeps the remaining unpainted strip; returns the animation. */
  finishPaint(id: PassId, duration = 450): Promise<void> {
    const p = this.passes[id];
    if (p.hi < p.lo) {
      p.lo = p.hi = this.sMin;
    }
    tweens.to(p, { lo: this.sMin - 0.5, hi: this.sMax + 0.5 }, duration, Ease.quadInOut).onUpdate(() => this.applyPass(p));
    return tweens.wait(duration + 20).then(() => {
      if (id === 'roof') this.unpainted.visible = false;
    });
  }

  flashPainted(id: PassId): void {
    for (const m of this.passes[id].painted) {
      m.emissive.setRGB(1, 1, 1);
      m.emissiveIntensity = 0.55;
      tweens.to(m, { emissiveIntensity: 0 }, 650, Ease.quadOut);
    }
  }

  // ------------------------------------------------------------------ ending

  bloomFlowers(): void {
    this.flowers.forEach((f, i) => {
      f.visible = true;
      const s = f.scale;
      s.set(0.001, 0.001, 0.001);
      const k = rand(0.9, 1.3);
      tweens.to(s, { x: k * 0.8, z: k * 0.8, y: k * 1.45 }, 200, Ease.quadOut, 80 + i * 70);
      tweens.to(s, { x: k, y: k, z: k }, 650, Ease.elasticOut, 280 + i * 70);
    });
  }

  update(dt: number): void {
    this.time += dt / 1000;
    const t = this.time;
    for (const s of this.sway) {
      s.obj.rotation.z = Math.sin(t * 1.4 + s.phase) * s.amp;
      s.obj.rotation.x = Math.cos(t * 1.1 + s.phase) * s.amp * 0.6;
      s.amp += (0.022 - s.amp) * (1 - Math.exp(-dt / 900));
    }
    for (const c of this.clouds) {
      c.position.x += dt * 0.0006;
      if (c.position.x > 32) c.position.x = -32;
    }
    if (this.view.orbiting) {
      this.orbitT += (dt / 1000) * config.camera.orbitSpeed;
      this.view.orbit = Math.sin(this.orbitT) * this.orbitAmp.v;
    }
    this.shake *= Math.exp(-dt / 90);
    this.updateCamera();
    this.renderer.render(this.scene, this.camera);
  }
}
