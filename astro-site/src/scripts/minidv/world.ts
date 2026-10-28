// The desk, modelled. Every object on it is built to measurements taken from a Polycam scan of the real desk and textured with
// flattened crops of the real photographs (props.ts), then lit like the room: a warm lamp from the right with soft shadows, the
// cool light of the monitor, an environment for the reflections. The camera is a seated eye that glides along a path as you scroll
// (the way the New York Times' Jackson Heights tour flies through its scans). What moves is built here: the acrylic drawer, the
// cassettes in their cases, the deck's screen.
import * as THREE from "three";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { TAPES } from "../../lib/minidv";
import { drawCassette, drawEdge, drawInsert } from "./tapeArt";
import { blobTexture, glowTexture, loadTex } from "./materials";
import { buildProps, type PropTextures } from "./props";
import { CASE, DECK_BAY_Y, DECK_FRONT, DECK_TOP_Y, DESK_Y, DRAWER, INTO, LAMP, LATERAL, LCD, LCD_CENTRE, LCD_NORMAL, LCD_UP, MONITOR, TAPE, V } from "./space";
import { sfx } from "./sfx";
import type { DeckScreen } from "./deck";

// --- the camera's path -------------------------------------------------------------------------------------------------------
interface Pose {
  pos: THREE.Vector3;
  tgt: THREE.Vector3;
  fov: number;
  /** which way is up on the screen: tilted to the deck's own screen when watching, so the picture is upright */
  up: THREE.Vector3;
}
const pose = (pos: THREE.Vector3, tgt: THREE.Vector3, fov: number, up = V(0, 1, 0)): Pose => ({ pos, tgt, fov, up });
/** the stops of the walk, in order; the page's captions are keyed to the same count */
export const STOPS: Pose[] = [
  pose(V(-1.15, 0.2, 0.0), V(0, -0.08, 0.02), 52), // the desk
  pose(V(-0.8, 0.12, 0.0), V(0, -0.12, 0.0), 50), // from the seat
  pose(V(-0.6, -0.04, -0.12), V(-0.226, -0.28, -0.44), 46), // the arcade stick
  pose(V(-0.62, -0.02, 0.4), V(-0.24, -0.26, 0.34), 40), // the deck
  pose(V(-0.52, 0.1, 0.64), V(-0.2, -0.31, 0.62), 48), // the art book
  pose(V(-0.36, -0.12, 0.08), V(0.02, -0.3, 0.08), 42), // the drawer
];
const POSE_DRAWER = pose(V(-0.34, 0.0, 0.08), V(-0.005, -0.29, 0.08), 42);
const POSE_CARRY = pose(V(-0.62, 0.03, 0.2), V(-0.2, -0.28, 0.2), 50);
const POSE_WATCH = pose(LCD_CENTRE.clone().addScaledVector(LCD_NORMAL, 0.3), LCD_CENTRE.clone(), 34, LCD_UP.clone());

const posCurve = new THREE.CatmullRomCurve3(STOPS.map((s) => s.pos), false, "centripetal");
const tgtCurve = new THREE.CatmullRomCurve3(STOPS.map((s) => s.tgt), false, "centripetal");
function tourPose(p: number): Pose {
  const u = THREE.MathUtils.clamp(p, 0, 1);
  const f = u * (STOPS.length - 1);
  const i = Math.min(STOPS.length - 2, Math.floor(f));
  const k = f - i;
  return { pos: posCurve.getPoint(u), tgt: tgtCurve.getPoint(u), fov: THREE.MathUtils.lerp(STOPS[i].fov, STOPS[i + 1].fov, k), up: V(0, 1, 0) };
}

// --- small helpers ----------------------------------------------------------------------------------------------------------
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
interface Tween {
  t: number;
  dur: number;
  ease: (t: number) => number;
  step: (k: number) => void;
  done: () => void;
}

type Hit = { kind: "tape"; id: string } | { kind: "drawer" } | { kind: "deck" };
export interface Hover {
  label: string;
  x: number;
  y: number;
  tapeId?: string;
}
export interface WorldEvents {
  onPickTape: (id: string) => void;
  onDrawer: () => void;
  onDeck: () => void;
  onHover: (h: Hover | null) => void;
}

interface TapeObj {
  id: string;
  slot: THREE.Group; // the case, standing in the drawer
  cassette: THREE.Mesh;
  home: THREE.Vector3; // the cassette's place inside the case (slot-local)
  hit: THREE.Mesh;
  lift: number;
}

const LEAN = -0.52; // each case leans toward the seat, resting on the one in front, so every paper insert shows
const qStand = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), -Math.PI / 2); // label toward the seat
const qFlat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(LATERAL, INTO, V(0, 1, 0))); // label up, top edge toward the deck
/** where a cassette hovers before it goes in (in front of the deck), and where it goes down (over the cassette bay) */
const HOVER_DEPTH = -0.05;
const BAY_DEPTH = 0.06;
const alongDeck = (depth: number, y: number) => V(DECK_FRONT.x + INTO.x * depth, y, DECK_FRONT.z + INTO.z * depth);

export class DeskWorld {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(50, 1, 0.01, 30);
  private readonly drawer = new THREE.Group();
  private drawerHit!: THREE.Mesh;
  private deckLid: THREE.Group | null = null;
  private readonly deckHit: THREE.Mesh;
  private readonly drawerShadow: THREE.Mesh;
  private readonly tapes: TapeObj[] = [];
  private readonly lcdMat: THREE.MeshBasicMaterial;
  private readonly lcdTex: THREE.CanvasTexture;
  private readonly glow: THREE.Sprite;
  private readonly lcdLight: THREE.PointLight;
  private readonly ray = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly par = new THREE.Vector2();
  private readonly parTo = new THREE.Vector2();
  private readonly tweens: Tween[] = [];
  private readonly cleanups: (() => void)[] = [];
  private readonly t0 = performance.now();
  private progress = 0;
  private shown = 0;
  private free = false; // true while the camera is being directed (choosing a tape) instead of following the scroll
  private freePose: Pose = pose(V(0, 0, 0), V(0, 0, 1), 50);
  private view: Pose = pose(V(0, 0, 0), V(0, 0, 1), 50);
  private hovered: Hit | null = null;
  private down: { x: number; y: number } | null = null;
  private listHover: string | null = null;
  private open = 0; // 0 closed .. 1 open
  private aspect = 1.6;
  private lcdOn = 0;
  private camId = 0;
  /** a sequence is running: the desk ignores clicks until it is done */
  busy = false;
  speed = 1;
  ready: Promise<void>;

  constructor(
    private readonly host: HTMLElement,
    private readonly screen: DeckScreen,
    private readonly ev: WorldEvents,
  ) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x0b0907, 1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.localClippingEnabled = true;
    renderer.domElement.className = "md-canvas";
    renderer.domElement.setAttribute("aria-hidden", "true");
    host.appendChild(renderer.domElement);
    this.renderer = renderer;
    this.scene.fog = new THREE.Fog(0x0b0907, 1.6, 3.6);

    this.lights();

    // the deck's screen, and the light it gives off
    this.lcdTex = new THREE.CanvasTexture(screen.canvas);
    this.lcdTex.colorSpace = THREE.SRGBColorSpace;
    this.lcdTex.generateMipmaps = false;
    this.lcdTex.minFilter = THREE.LinearFilter;
    this.lcdMat = new THREE.MeshBasicMaterial({ map: this.lcdTex, transparent: true, opacity: 0, toneMapped: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    const lcdGeo = new THREE.BufferGeometry();
    lcdGeo.setAttribute("position", new THREE.Float32BufferAttribute(LCD.flatMap((p) => p.clone().addScaledVector(LCD_NORMAL, 0.0009).toArray()), 3));
    lcdGeo.setAttribute("uv", new THREE.Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 0], 2));
    lcdGeo.setIndex([0, 3, 2, 0, 2, 1]);
    this.scene.add(new THREE.Mesh(lcdGeo, this.lcdMat));
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    this.glow.position.copy(LCD_CENTRE).addScaledVector(LCD_NORMAL, 0.05);
    this.glow.scale.setScalar(0.3);
    this.scene.add(this.glow);
    this.lcdLight = new THREE.PointLight(0xc4d4ff, 0, 0.5, 2);
    this.lcdLight.position.copy(LCD_CENTRE).addScaledVector(LCD_NORMAL, 0.12);
    this.scene.add(this.lcdLight);

    this.deckHit = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial());
    this.deckHit.position.set(-0.25, -0.28, 0.34);
    this.deckHit.visible = false;
    this.scene.add(this.deckHit);

    // the drawer
    this.drawerShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(DRAWER.w + 0.07, DRAWER.d + 0.07),
      new THREE.MeshBasicMaterial({ map: blobTexture(), color: 0x000000, transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false }),
    );
    this.drawerShadow.rotation.x = -Math.PI / 2;
    this.drawerShadow.rotation.z = Math.PI / 2;
    this.drawerShadow.renderOrder = 2;
    this.scene.add(this.drawerShadow);
    this.buildDrawer();
    this.buildTapes();
    this.setDrawer(0);

    this.ready = this.load();

    // input
    const el = renderer.domElement;
    const on = <K extends keyof HTMLElementEventMap>(type: K, fn: (e: HTMLElementEventMap[K]) => void) => {
      el.addEventListener(type, fn as EventListener);
      this.cleanups.push(() => el.removeEventListener(type, fn as EventListener));
    };
    on("pointermove", (e) => this.move(e));
    on("pointerleave", () => {
      this.parTo.set(0, 0);
      this.setHover(null, 0, 0);
    });
    on("pointerdown", (e) => (this.down = { x: e.clientX, y: e.clientY }));
    on("pointerup", (e) => {
      const d = this.down;
      this.down = null;
      if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 8) this.click(e);
    });
    const ro = new ResizeObserver(() => this.resize());
    ro.observe(host);
    this.cleanups.push(() => ro.disconnect());
    this.resize();
    this.view = tourPose(0);
  }

  // --- building ---------------------------------------------------------------------------------------------------------------
  private lights() {
    RectAreaLightUniformsLib.init();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.24;
    pmrem.dispose();

    // the lamp at the right: warm, with soft shadows that fall toward the seat
    const key = new THREE.SpotLight(0xffe2b8, 7, 0, 1.05, 0.9, 2);
    key.position.copy(LAMP.bulb);
    key.target.position.set(-0.2, -0.33, -0.05);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.radius = 7;
    key.shadow.blurSamples = 16;
    key.shadow.bias = -0.0003;
    key.shadow.intensity = 1;
    key.shadow.normalBias = 0.002;
    key.shadow.camera.near = 0.3;
    key.shadow.camera.far = 3;
    this.scene.add(key, key.target);
    // the room's own light, from above and behind the seat, so the lamp's side is not the only lit one
    const room = new THREE.SpotLight(0xfff0dc, 6, 0, 0.9, 1, 2);
    room.position.set(-0.8, 0.9, 0.2);
    room.target.position.set(-0.1, -0.33, 0.1);
    this.scene.add(room, room.target);

    // the monitor's cool light on the keyboard and the desk in front of it
    const mon = new THREE.RectAreaLight(0xaec6ff, 1.7, MONITOR.halfW * 2, MONITOR.y1 - MONITOR.y0);
    mon.position.set(MONITOR.x - 0.02, (MONITOR.y0 + MONITOR.y1) / 2, MONITOR.z);
    mon.lookAt(-1, (MONITOR.y0 + MONITOR.y1) / 2 - 0.5, MONITOR.z);
    this.scene.add(mon);

    // the light bar over the screen, pointing down at the desk
    const bar = new THREE.SpotLight(0xfff0dc, 1.1, 0, 0.7, 1, 2);
    bar.position.set(MONITOR.x - 0.03, MONITOR.y1 + 0.03, MONITOR.z);
    bar.target.position.set(-0.2, DESK_Y, MONITOR.z);
    this.scene.add(bar, bar.target);

    // a little bounce from the room itself
    this.scene.add(new THREE.HemisphereLight(0xfff1de, 0x7a6448, 0.1));
  }

  private async load() {
    const [stickTop, bookCover, deckFlap, deckTop, deckSticker, standee] = await Promise.all(
      ["stick-top", "book-cover", "deck-flap", "deck-top", "deck-sticker", "standee"].map((n) => loadTex(`/minidv/tex/${n}.jpg`)),
    );
    const tex: PropTextures = { stickTop, bookCover, deckFlap, deckTop, deckSticker, standee };
    const props = buildProps(tex);
    this.scene.add(props.group);
    this.deckLid = props.deckLid;
  }

  private acrylic(opacity: number) {
    return new THREE.MeshPhysicalMaterial({ color: 0xe9f4ff, transparent: true, opacity, roughness: 0.22, metalness: 0, clearcoat: 0, envMapIntensity: 0.25, depthWrite: false, side: THREE.DoubleSide });
  }

  private buildDrawer() {
    const edge = new THREE.LineBasicMaterial({ color: 0xf2f8ff, transparent: true, opacity: 0.5 });
    const part = (sx: number, sy: number, sz: number, x: number, y: number, z: number, opacity: number, order: number) => {
      const geo = new THREE.BoxGeometry(sx, sy, sz);
      const m = new THREE.Mesh(geo, this.acrylic(opacity));
      m.position.set(x, y, z);
      m.renderOrder = order;
      m.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), edge));
      this.drawer.add(m);
    };
    const { w, d, h } = DRAWER;
    const th = 0.003;
    part(d, th, w, 0, th / 2, 0, 0.5, 3); // floor
    part(d, h, th, 0, h / 2, -w / 2 + th / 2, 0.16, 5); // sides
    part(d, h, th, 0, h / 2, w / 2 - th / 2, 0.16, 5);
    part(th, h, w, d / 2 - th / 2, h / 2, 0, 0.16, 5); // back
    part(th * 1.4, h + 0.004, w, -d / 2 + th * 0.7, (h + 0.004) / 2, 0, 0.26, 6); // front
    const grip = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.008), new THREE.MeshBasicMaterial({ color: 0x0c1014, transparent: true, opacity: 0.7, depthWrite: false }));
    grip.rotation.y = -Math.PI / 2;
    grip.position.set(-d / 2 - 0.0006, h * 0.72, 0);
    grip.renderOrder = 7;
    this.drawer.add(grip);

    this.drawerHit = new THREE.Mesh(new THREE.BoxGeometry(0.05, h + 0.01, w), new THREE.MeshBasicMaterial());
    this.drawerHit.position.set(-d / 2 + 0.02, h / 2, 0);
    this.drawerHit.visible = false;
    this.drawer.add(this.drawerHit);
    this.drawer.position.set(0, DESK_Y, DRAWER.z);
    this.scene.add(this.drawer);
  }

  private buildTapes() {
    const caseGeo = new THREE.BoxGeometry(CASE.t, CASE.h, CASE.w);
    const caseMat = new THREE.MeshPhysicalMaterial({ color: 0xf4f8ff, transparent: true, opacity: 0.1, roughness: 0.2, clearcoat: 0, envMapIntensity: 0.2, depthWrite: false, side: THREE.DoubleSide });
    const edgeMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.42 });
    const spineMat = new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.4 });
    const cassetteGeo = new RoundedBoxGeometry(TAPE.w, TAPE.h, TAPE.t, 2, 0.0016);
    const perStack = 7;
    const spacing = 0.0255;
    const front = -DRAWER.d / 2 + 0.042;

    TAPES.forEach((tape, i) => {
      const stack = Math.floor(i / perStack);
      const n = i % perStack;
      const slot = new THREE.Group();
      slot.position.set(front + n * spacing, 0.003 + (CASE.h / 2) * Math.cos(LEAN), (stack === 0 ? -1 : 1) * 0.062);
      slot.rotation.z = -LEAN;
      slot.userData.id = tape.id;

      const shell = new THREE.Mesh(caseGeo, caseMat);
      shell.renderOrder = 8;
      shell.add(new THREE.LineSegments(new THREE.EdgesGeometry(caseGeo), edgeMat));
      slot.add(shell);
      const spine = new THREE.Mesh(new THREE.BoxGeometry(CASE.t, CASE.h, 0.004), spineMat);
      spine.position.z = CASE.w / 2 - 0.002;
      slot.add(spine);

      // the paper insert, behind the clear front
      const insTex = new THREE.CanvasTexture(drawInsert(tape));
      insTex.colorSpace = THREE.SRGBColorSpace;
      insTex.anisotropy = 8;
      const insert = new THREE.Mesh(new THREE.PlaneGeometry(0.0665, 0.0485), new THREE.MeshStandardMaterial({ map: insTex, roughness: 0.85, emissive: 0xffffff, emissiveMap: insTex, emissiveIntensity: 0.22 }));
      insert.rotation.y = -Math.PI / 2;
      insert.position.x = -CASE.t / 2 + 0.0012;
      insert.receiveShadow = true;
      slot.add(insert);

      // the cassette, label toward the seat, behind the insert
      const labelTex = new THREE.CanvasTexture(drawCassette(tape));
      labelTex.colorSpace = THREE.SRGBColorSpace;
      labelTex.anisotropy = 8;
      const edgeTex = new THREE.CanvasTexture(drawEdge(tape));
      edgeTex.colorSpace = THREE.SRGBColorSpace;
      edgeTex.anisotropy = 8;
      const shellDark = new THREE.MeshStandardMaterial({ color: 0x1b1c20, roughness: 0.5 });
      const label = new THREE.MeshStandardMaterial({ map: labelTex, roughness: 0.42, emissive: 0xffffff, emissiveMap: labelTex, emissiveIntensity: 0.18 });
      const edge = new THREE.MeshStandardMaterial({ map: edgeTex, roughness: 0.45, emissive: 0xffffff, emissiveMap: edgeTex, emissiveIntensity: 0.3 });
      const cassette = new THREE.Mesh(cassetteGeo, [shellDark, shellDark, edge, shellDark, label, shellDark]);
      cassette.quaternion.copy(qStand);
      cassette.castShadow = true;
      cassette.receiveShadow = true;
      const home = V(0.0025, 0, 0);
      cassette.position.copy(home);
      slot.add(cassette);

      const hit = new THREE.Mesh(new THREE.BoxGeometry(spacing * 1.1, CASE.h, CASE.w), new THREE.MeshBasicMaterial());
      hit.visible = false;
      hit.userData.id = tape.id;
      slot.add(hit);

      this.drawer.add(slot);
      this.tapes.push({ id: tape.id, slot, cassette, home, hit, lift: 0 });
    });
  }

  private setDrawer(open: number) {
    this.open = open;
    const front = DRAWER.closedFront - open * DRAWER.travel;
    this.drawer.position.x = front + DRAWER.d / 2;
    this.drawerShadow.position.set(this.drawer.position.x - 0.012, DESK_Y + 0.0015, DRAWER.z + 0.014);
  }

  // --- the camera -------------------------------------------------------------------------------------------------------------
  /** the page's scroll position, 0 to 1 along the walk */
  setProgress(p: number) {
    this.progress = THREE.MathUtils.clamp(p, 0, 1);
  }

  /** direct the camera for a moment (choosing a tape); `tour` hands it back to the scroll */
  cam(name: "drawer" | "carry" | "watch" | "tour", seconds = 1.1): Promise<void> {
    const to = name === "drawer" ? POSE_DRAWER : name === "carry" ? POSE_CARRY : name === "watch" ? POSE_WATCH : tourPose(this.progress);
    if (!this.free) this.freePose = { pos: this.view.pos.clone(), tgt: this.view.tgt.clone(), fov: this.view.fov, up: this.view.up.clone() };
    this.free = true;
    const from = { pos: this.freePose.pos.clone(), tgt: this.freePose.tgt.clone(), fov: this.freePose.fov, up: this.freePose.up.clone() };
    const id = ++this.camId;
    return this.run(seconds, (k) => {
      if (id !== this.camId) return;
      this.freePose.pos.lerpVectors(from.pos, to.pos, k);
      this.freePose.tgt.lerpVectors(from.tgt, to.tgt, k);
      this.freePose.fov = THREE.MathUtils.lerp(from.fov, to.fov, k);
      this.freePose.up.lerpVectors(from.up, to.up, k).normalize();
      if (k >= 1 && name === "tour") {
        this.free = false;
        this.shown = this.progress;
      }
    });
  }

  // --- tweening ---------------------------------------------------------------------------------------------------------------
  run(seconds: number, step: (k: number) => void, ease = easeInOut): Promise<void> {
    const dur = seconds / this.speed;
    if (dur <= 0.001) {
      step(1);
      return Promise.resolve();
    }
    return new Promise((resolve) => this.tweens.push({ t: 0, dur, ease, step, done: resolve }));
  }

  get drawerOpen() {
    return this.open > 0.5;
  }

  async openDrawer() {
    if (this.open >= 1) return;
    sfx.drawer(true);
    const from = this.open;
    await Promise.all([this.cam("drawer", 1.0), this.run(1.0, (k) => this.setDrawer(THREE.MathUtils.lerp(from, 1, k)))]);
  }

  async closeDrawer() {
    if (this.open <= 0) return;
    sfx.drawer(false);
    const from = this.open;
    await this.run(0.9, (k) => this.setDrawer(THREE.MathUtils.lerp(from, 0, k)));
  }

  private tape(id: string) {
    const t = this.tapes.find((x) => x.id === id);
    if (!t) throw new Error(`no tape ${id}`);
    return t;
  }

  private cassetteWorld(t: TapeObj) {
    t.cassette.updateWorldMatrix(true, false);
    return {
      pos: new THREE.Vector3().setFromMatrixPosition(t.cassette.matrixWorld),
      quat: t.cassette.getWorldQuaternion(new THREE.Quaternion()),
    };
  }

  private flyCassette(t: TapeObj, to: THREE.Vector3, quat: THREE.Quaternion, seconds: number, apex: number) {
    const p0 = t.cassette.position.clone();
    const q0 = t.cassette.quaternion.clone();
    const ctrl = p0.clone().lerp(to, 0.5);
    ctrl.y += apex;
    return this.run(seconds, (k) => {
      const a = (1 - k) * (1 - k);
      const b = 2 * (1 - k) * k;
      const c = k * k;
      t.cassette.position.set(a * p0.x + b * ctrl.x + c * to.x, a * p0.y + b * ctrl.y + c * to.y, a * p0.z + b * ctrl.z + c * to.z);
      t.cassette.quaternion.slerpQuaternions(q0, quat, k);
    });
  }

  /** the deck's top panel (with the controls) lifts on its back hinge to open the cassette bay, or comes down again */
  lid(open: boolean) {
    const g = this.deckLid;
    if (!g) return Promise.resolve();
    const from = g.rotation.x;
    const to = open ? -1.22 : 0;
    sfx.beep();
    return this.run(0.6, (k) => (g.rotation.x = THREE.MathUtils.lerp(from, to, k)));
  }

  /** lift the cassette out of its case and carry it to the front of the deck */
  async carryToDeck(id: string) {
    const t = this.tape(id);
    sfx.pick();
    // up out of the case
    const up = t.home.clone().add(V(0, CASE.h * 0.8, 0));
    await this.run(0.45, (k) => t.cassette.position.lerpVectors(t.home, up, k));
    // now it belongs to the room, not the drawer
    const w = this.cassetteWorld(t);
    this.scene.attach(t.cassette);
    t.cassette.position.copy(w.pos);
    t.cassette.quaternion.copy(w.quat);
    const hover = alongDeck(HOVER_DEPTH, DECK_TOP_Y + 0.07);
    await Promise.all([this.cam("carry", 1.1), this.flyCassette(t, hover.clone().add(V(0, 0.05, 0)), qFlat, 1.1, 0.08)]);
    await this.flyCassette(t, hover, qFlat, 0.4, 0);
  }

  /** the lid goes up, the cassette goes over the bay and down into it, the lid comes down */
  async insert(id: string) {
    const t = this.tape(id);
    await this.lid(true);
    sfx.slide();
    const p0 = t.cassette.position.clone();
    const over = alongDeck(BAY_DEPTH, p0.y);
    await this.run(0.7, (k) => t.cassette.position.lerpVectors(p0, over, k));
    const down = over.clone().setY(DECK_BAY_Y + TAPE.t / 2 + 0.004);
    await this.run(0.6, (k) => t.cassette.position.lerpVectors(over, down, k));
    sfx.clunk();
    await this.lid(false);
    t.cassette.visible = false;
  }

  /** the lid goes up and the cassette rises out of the bay and out toward the front */
  async slideOut(id: string) {
    const t = this.tape(id);
    t.cassette.visible = true;
    sfx.clunk();
    window.setTimeout(() => sfx.slide(), 200);
    const inside = alongDeck(BAY_DEPTH, DECK_BAY_Y + TAPE.t / 2 + 0.004);
    const over = alongDeck(BAY_DEPTH, DECK_TOP_Y + 0.06);
    const out = alongDeck(HOVER_DEPTH, DECK_TOP_Y + 0.07);
    t.cassette.position.copy(inside);
    t.cassette.quaternion.copy(qFlat);
    await this.lid(true);
    await this.run(0.6, (k) => t.cassette.position.lerpVectors(inside, over, easeOut(k)));
    await this.run(0.7, (k) => t.cassette.position.lerpVectors(over, out, k));
    await this.lid(false);
  }

  /** fly the cassette home into its case */
  async putBack(id: string) {
    const t = this.tape(id);
    sfx.pick();
    const above = t.slot.localToWorld(t.home.clone().add(V(0, CASE.h * 0.8, 0)));
    const qAbove = t.slot.getWorldQuaternion(new THREE.Quaternion()).multiply(qStand);
    await this.flyCassette(t, above, qAbove, 1.0, 0.07);
    t.slot.attach(t.cassette);
    const from = t.cassette.position.clone();
    await this.run(0.4, (k) => t.cassette.position.lerpVectors(from, t.home, k));
    t.cassette.quaternion.copy(qStand);
    sfx.beep();
  }

  /** the screen and its light come on, or go off */
  setLcd(on: boolean) {
    const from = this.lcdOn;
    const to = on ? 1 : 0;
    return this.run(0.6, (k) => {
      this.lcdOn = THREE.MathUtils.lerp(from, to, k);
      this.lcdMat.opacity = this.lcdOn;
      (this.glow.material as THREE.SpriteMaterial).opacity = this.lcdOn * 0.4;
      this.lcdLight.intensity = this.lcdOn * 0.07;
    });
  }

  /** the list on the side is hovering a tape: it rises a little in its stack */
  highlight(id: string | null) {
    this.listHover = id;
  }

  /** where the "pull the drawer" hint belongs on the screen, in CSS pixels */
  hintPosition(): { x: number; y: number } {
    const v = V(DRAWER.closedFront - 0.01, DESK_Y + 0.03, DRAWER.z).project(this.camera);
    const r = this.host.getBoundingClientRect();
    return { x: ((v.x + 1) / 2) * r.width, y: ((1 - v.y) / 2) * r.height };
  }

  // --- input ------------------------------------------------------------------------------------------------------------------
  private move(e: PointerEvent) {
    const r = this.host.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
    const ny = -(((e.clientY - r.top) / r.height) * 2 - 1);
    this.pointer.set(nx, ny);
    this.parTo.set(nx, ny);
    this.setHover(this.pick(), e.clientX - r.left, e.clientY - r.top);
  }

  private pick(): Hit | null {
    if (this.busy) return null;
    this.camera.updateMatrixWorld();
    this.ray.setFromCamera(this.pointer, this.camera);
    const objs: THREE.Object3D[] = [this.drawerHit, this.deckHit];
    if (this.open > 0.9) objs.push(...this.tapes.filter((t) => t.cassette.parent === t.slot).map((t) => t.hit));
    const hit = this.ray.intersectObjects(objs, false)[0];
    if (!hit) return null;
    if (hit.object === this.drawerHit) return { kind: "drawer" };
    if (hit.object === this.deckHit) return { kind: "deck" };
    return { kind: "tape", id: hit.object.userData.id as string };
  }

  private setHover(hit: Hit | null, x: number, y: number) {
    this.hovered = hit;
    this.renderer.domElement.style.cursor = hit ? "pointer" : "";
    if (!hit) return this.ev.onHover(null);
    if (hit.kind === "tape") this.ev.onHover({ label: TAPES.find((t) => t.id === hit.id)?.title ?? "", x, y, tapeId: hit.id });
    else if (hit.kind === "drawer") this.ev.onHover({ label: this.open > 0.5 ? "Push the drawer in" : "Pull the drawer", x, y });
    else this.ev.onHover({ label: this.screen.tape ? "Watch" : "Sony Mini DV deck", x, y });
  }

  private click(e: PointerEvent) {
    const r = this.host.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
    const hit = this.pick();
    if (!hit) return;
    if (hit.kind === "tape") this.ev.onPickTape(hit.id);
    else if (hit.kind === "drawer") this.ev.onDrawer();
    else this.ev.onDeck();
  }

  // --- frame loop -------------------------------------------------------------------------------------------------------------
  private resize() {
    const w = Math.max(1, this.host.clientWidth);
    const h = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.aspect = w / h;
    this.camera.aspect = this.aspect;
    this.camera.updateProjectionMatrix();
  }

  render(dtSeconds: number) {
    const dt = Math.min(dtSeconds, 0.05);
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      tw.t = Math.min(1, tw.t + dt / tw.dur);
      tw.step(tw.ease(tw.t));
      if (tw.t >= 1) {
        this.tweens.splice(i, 1);
        tw.done();
      }
    }

    // the walk follows the scroll with a little weight, so it glides instead of tracking the wheel
    this.shown += (this.progress - this.shown) * (1 - Math.exp(-dt * 3.4));
    const base = this.free ? this.freePose : tourPose(this.shown);
    // a narrow screen needs a wider lens to keep the same view
    const fov = Math.min(95, base.fov * (this.aspect < 1 ? 1 + (1 - this.aspect) * 0.9 : 1));
    this.view = { pos: base.pos, tgt: base.tgt, fov: base.fov, up: base.up };

    // pointer parallax and the breathing of a head
    this.par.lerp(this.parTo, 1 - Math.exp(-dt * 3.5));
    const t = (performance.now() - this.t0) / 1000;
    const fwd = base.tgt.clone().sub(base.pos).normalize();
    const right = new THREE.Vector3().crossVectors(fwd, V(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, fwd).normalize();
    const reach = this.free ? 0.35 : 1; // while a tape is being handled the view stays put
    this.camera.position
      .copy(base.pos)
      .addScaledVector(right, this.par.x * 0.022 * reach + Math.sin(t * 0.37) * 0.0028)
      .addScaledVector(up, this.par.y * 0.012 * reach + Math.sin(t * 0.53 + 1) * 0.002);
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
    this.camera.up.copy(base.up);
    this.camera.lookAt(base.tgt);

    // cassettes in the drawer rise a little when pointed at
    for (const tp of this.tapes) {
      if (tp.cassette.parent !== tp.slot) continue;
      const pointed = this.hovered?.kind === "tape" && this.hovered.id === tp.id;
      const on = this.open > 0.95 && !this.busy && (pointed || this.listHover === tp.id);
      tp.lift += ((on ? 1 : 0) - tp.lift) * (1 - Math.exp(-dt * 12));
      tp.slot.position.y = 0.003 + (CASE.h / 2) * Math.cos(LEAN) + tp.lift * 0.022;
    }

    if (this.screen.state !== "empty") this.lcdTex.needsUpdate = true;
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.cleanups.forEach((f) => f());
    this.tweens.length = 0;
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      mats.forEach((mat) => {
        (mat as THREE.MeshBasicMaterial).map?.dispose();
        mat.dispose();
      });
    });
    this.lcdTex.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
