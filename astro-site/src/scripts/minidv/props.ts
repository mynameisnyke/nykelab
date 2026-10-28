// The things on the desk, modelled to the measurements in space.ts and textured with flattened crops of the real photographs
// (the stick's art plate and the book's cover from the a7R overhead, the Sony's sticker front, flap and control panel, the standee).
// Nothing here moves except what world.ts animates (the drawer, the cassettes, the deck's lid and screen).
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { bamboo, blobTexture, oak, plaster } from "./materials";
import { drawCassette } from "./tapeArt";
import { BOOK, DECK, DECK_FRONT, DESK, DESK_Y, FLAP, INTO, LAMP, LATERAL, LCD_CENTRE, LCD_NORMAL, LCD_RIGHT, LCD_UP, MONITOR, SHELF, STICK, V, yawFor } from "./space";

export interface PropTextures {
  stickTop: THREE.Texture;
  bookCover: THREE.Texture;
  deckFlap: THREE.Texture;
  deckTop: THREE.Texture;
  deckSticker: THREE.Texture;
  standee: THREE.Texture;
}
export interface Props {
  group: THREE.Group;
  /** the deck's top panel, hinged at the back: rotation.x = -angle lifts its front */
  deckLid: THREE.Group;
}

const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(o);
const phys = (o: THREE.MeshPhysicalMaterialParameters) => new THREE.MeshPhysicalMaterial(o);
const rbox = (w: number, h: number, d: number, r = 0.003) => new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4));
const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
};
/** a flat plane lying face up, its image top toward local -z (away from the seat) */
const flat = (w: number, d: number, mat: THREE.Material, y = 0) => {
  const m = mesh(new THREE.PlaneGeometry(w, d), mat, 0, y, 0);
  m.rotation.x = -Math.PI / 2;
  m.castShadow = false;
  return m;
};
const tube = (pts: THREE.Vector3[], r: number, mat: THREE.Material, seg = 80) => mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), seg, r, 10), mat);
/** a cylinder between two points */
const rod = (a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material) => {
  const len = a.distanceTo(b);
  const m = mesh(new THREE.CylinderGeometry(r, r, len, 16), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize());
  return m;
};

const blob = blobTexture();
/** the soft shadow a thing leaves on the desk right under itself (the shadow map handles the long ones) */
function contact(parent: THREE.Object3D, x: number, z: number, w: number, d: number, yaw: number, opacity = 0.5) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: blob, color: 0x000000, transparent: true, opacity: Math.min(1, opacity * 1.5), depthWrite: false, toneMapped: false }));
  m.rotation.x = -Math.PI / 2;
  m.rotation.z = yaw;
  m.position.set(x, DESK_Y + 0.0006, z);
  m.renderOrder = 1;
  parent.add(m);
}

// --- the room ----------------------------------------------------------------------------------------------------------------
function room(g: THREE.Group) {
  const b = bamboo();
  const repeat = new THREE.Vector2((DESK.x1 - DESK.x0) / 0.6, (DESK.z1 - DESK.z0) / 0.6);
  b.map.repeat.copy(repeat);
  b.rough.repeat.copy(repeat);
  const top = mesh(rbox(DESK.x1 - DESK.x0, DESK.thick, DESK.z1 - DESK.z0, 0.008), phys({ map: b.map, roughnessMap: b.rough, roughness: 0.6, clearcoat: 0.18, clearcoatRoughness: 0.35 }), (DESK.x0 + DESK.x1) / 2, DESK_Y - DESK.thick / 2, 0);
  top.castShadow = false;
  g.add(top);

  // white walls: the back, and the two sides of the alcove the desk sits in
  const wallTex = plaster();
  wallTex.repeat.set(3, 2);
  const wallMat = std({ map: wallTex, roughness: 0.92, color: 0xf2ece0 });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(4, 2.6), wallMat);
  back.rotation.y = -Math.PI / 2;
  back.position.set(DESK.x1, DESK_Y + 0.9, 0);
  back.receiveShadow = true;
  g.add(back);
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), wallMat);
    w.rotation.y = s < 0 ? 0 : Math.PI;
    w.position.set(DESK.x1 - 1.3, DESK_Y + 0.9, s * (DESK.z1 + 0.025));
    w.receiveShadow = true;
    g.add(w);
  }

  // the floor: dark wooden boards
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), std({ color: 0x361c13, roughness: 0.55 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = DESK_Y - 0.74;
  g.add(floor);
  const under = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.9), new THREE.MeshBasicMaterial({ color: 0x0b0907, side: THREE.DoubleSide }));
  under.position.set(DESK.x0 - 0.002, DESK_Y - 0.4, 0);
  under.rotation.y = Math.PI / 2;
  g.add(under);
}

// --- the shelf and what stands on it -------------------------------------------------------------------------------------------
function shelf(g: THREE.Group, tex: PropTextures) {
  const o = oak();
  o.map.repeat.set(0.5, 2);
  o.rough.repeat.set(0.5, 2);
  const w = SHELF.z1 - SHELF.z0;
  const d = SHELF.x1 - SHELF.x0;
  g.add(mesh(rbox(d, SHELF.thick, w, 0.006), std({ map: o.map, roughnessMap: o.rough, roughness: 0.55 }), (SHELF.x0 + SHELF.x1) / 2, SHELF.top - SHELF.thick / 2, (SHELF.z0 + SHELF.z1) / 2));
  // two white legs
  const legH = SHELF.top - SHELF.thick - DESK_Y;
  for (const z of [-0.28, 0.35]) g.add(mesh(rbox(d - 0.03, legH, 0.03, 0.003), std({ color: 0xece8e0, roughness: 0.6 }), (SHELF.x0 + SHELF.x1) / 2, DESK_Y + legH / 2, z));

  // the acrylic standee, with its art
  const sw = 0.106;
  const sh = sw * (960 / 1560);
  const st = new THREE.Group();
  st.add(mesh(new THREE.BoxGeometry(0.003, sh + 0.008, sw + 0.008), phys({ color: 0xeef6ff, roughness: 0.05, transparent: true, opacity: 0.25 }), 0, sh / 2 + 0.008, 0));
  const art = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), std({ map: tex.standee, roughness: 0.4, emissive: 0xffffff, emissiveMap: tex.standee, emissiveIntensity: 0.16 }));
  art.rotation.y = -Math.PI / 2;
  art.position.set(-0.0019, sh / 2 + 0.008, 0);
  st.add(art);
  st.add(mesh(rbox(0.026, 0.006, sw * 0.7, 0.002), phys({ color: 0xeaf4ff, roughness: 0.08, transparent: true, opacity: 0.55 }), 0, 0.003, 0));
  st.position.set(0.14, SHELF.top, -0.05);
  g.add(st);

  // the little jet on the shelf: white, with an orange tail and engines
  const jet = new THREE.Group();
  const white = std({ color: 0xf2f2f0, roughness: 0.35 });
  const orange = std({ color: 0xe7541c, roughness: 0.4 });
  const fus = mesh(new THREE.CylinderGeometry(0.0065, 0.0065, 0.15, 16), white);
  fus.rotation.z = Math.PI / 2;
  jet.add(fus);
  jet.add(mesh(new THREE.SphereGeometry(0.0065, 12, 8), white, 0.075, 0, 0));
  jet.add(mesh(new THREE.SphereGeometry(0.0065, 12, 8), orange, -0.075, 0, 0));
  jet.add(mesh(new THREE.BoxGeometry(0.03, 0.0012, 0.15), white, 0.008, -0.002, 0));
  jet.add(mesh(new THREE.BoxGeometry(0.018, 0.026, 0.0012), orange, -0.068, 0.014, 0));
  jet.add(mesh(new THREE.BoxGeometry(0.014, 0.0012, 0.05), white, -0.066, 0.0, 0));
  for (const z of [-0.022, 0.022]) {
    const eng = mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.022, 12), orange, 0.01, -0.0085, z);
    eng.rotation.z = Math.PI / 2;
    jet.add(eng);
  }
  jet.position.set(0.19, SHELF.top + 0.015, 0.27);
  jet.rotation.y = 0.5;
  g.add(jet);
}

// --- the monitor -----------------------------------------------------------------------------------------------------------------
function monitor(g: THREE.Group) {
  const { x, y0, y1, z, halfW, radius: R } = MONITOR;
  const h = y1 - y0;
  const half = Math.asin(halfW / R);
  const cx = x - R;
  const yc = (y0 + y1) / 2;
  const arc = (r: number, height: number, a: number, mat: THREE.Material) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, height, 72, 1, true, Math.PI / 2 - a, a * 2), mat);
    m.position.set(cx, yc, z);
    return m;
  };
  // a calm dark wallpaper: deep indigo into teal, a few soft lights, a thin menu bar and a dock
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 416;
  const gx = c.getContext("2d")!;
  const base = gx.createLinearGradient(0, 0, 1024, 416);
  base.addColorStop(0, "#0c1736");
  base.addColorStop(0.55, "#1a1b45");
  base.addColorStop(1, "#0a2a3a");
  gx.fillStyle = base;
  gx.fillRect(0, 0, 1024, 416);
  for (const [px, py, r, col] of [
    [250, 120, 280, "rgba(90,130,255,0.30)"],
    [760, 300, 320, "rgba(40,190,200,0.22)"],
    [560, 60, 220, "rgba(170,110,255,0.20)"],
  ] as [number, number, number, string][]) {
    const rg = gx.createRadialGradient(px, py, 4, px, py, r);
    rg.addColorStop(0, col);
    rg.addColorStop(1, "rgba(0,0,0,0)");
    gx.fillStyle = rg;
    gx.fillRect(0, 0, 1024, 416);
  }
  gx.fillStyle = "rgba(10,12,20,0.55)";
  gx.fillRect(0, 0, 1024, 16);
  gx.fillStyle = "rgba(255,255,255,0.16)";
  for (let i = 0; i < 6; i++) gx.fillRect(18 + i * 44, 5, 30, 6);
  gx.fillStyle = "rgba(240,244,255,0.10)";
  gx.beginPath();
  gx.roundRect(350, 380, 324, 30, 12);
  gx.fill();
  const screenTex = new THREE.CanvasTexture(c);
  screenTex.colorSpace = THREE.SRGBColorSpace;
  const screen = arc(R, h, half, phys({ color: 0x05060a, map: screenTex, emissive: 0xffffff, emissiveMap: screenTex, emissiveIntensity: 0.85, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.6, side: THREE.DoubleSide }));
  screen.receiveShadow = true;
  g.add(screen);
  const half2 = Math.asin((halfW + 0.01) / R);
  const bezel = arc(R + 0.004, h + 0.02, half2, std({ color: 0x0b0b0d, roughness: 0.35, metalness: 0.2, side: THREE.DoubleSide }));
  bezel.castShadow = true;
  g.add(bezel);
  g.add(arc(R + 0.03, h + 0.02, half2, std({ color: 0x151518, roughness: 0.5, side: THREE.DoubleSide })));
  // stand
  const dark = std({ color: 0x1a1b1e, roughness: 0.4, metalness: 0.5 });
  g.add(mesh(rbox(0.02, 0.15, 0.07, 0.004), dark, x + 0.07, SHELF.top + 0.075, z));
  g.add(mesh(rbox(0.2, 0.012, 0.28, 0.005), dark, x + 0.03, SHELF.top + 0.006, z));
  // the light bar on top, and the webcam
  const bar = new THREE.Group();
  bar.add(mesh(rbox(0.03, 0.024, 0.46, 0.008), std({ color: 0x151518, roughness: 0.35, metalness: 0.4 })));
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.014), new THREE.MeshBasicMaterial({ color: 0xfff1d6 }));
  strip.rotation.x = Math.PI / 2;
  strip.position.set(-0.004, -0.0125, 0);
  bar.add(strip);
  bar.position.set(x - 0.015, y1 + 0.032, z);
  g.add(bar);
  g.add(mesh(rbox(0.022, 0.028, 0.05, 0.005), dark, x - 0.012, y1 + 0.032 + 0.026, z));
}

// --- keyboard, with its coiled cable ---------------------------------------------------------------------------------------------
function keyboard(g: THREE.Group) {
  const kb = new THREE.Group();
  const W = 0.318;
  const D = 0.134;
  kb.add(mesh(rbox(D, 0.022, W, 0.006), std({ color: 0x9aa0a8, roughness: 0.38, metalness: 0.75 }), 0, 0.011, 0));
  kb.add(mesh(rbox(D - 0.012, 0.006, W - 0.012, 0.002), std({ color: 0x2a2d33, roughness: 0.6 }), 0, 0.0225, 0));

  const WHITE = 0xe9e6de;
  const BLUE = 0x2e63c8;
  const RED = 0xc23036;
  const YELLOW = 0xe6d02c;
  type Key = [number, number];
  const rows: Key[][] = [
    [[1, RED], ...Array.from({ length: 4 }, () => [1, WHITE] as Key), ...Array.from({ length: 4 }, () => [1, RED] as Key), ...Array.from({ length: 4 }, () => [1, WHITE] as Key), [1, BLUE], [1, BLUE]],
    [[1, BLUE], ...Array.from({ length: 12 }, () => [1, WHITE] as Key), [2, BLUE]],
    [[1.5, BLUE], ...Array.from({ length: 12 }, () => [1, WHITE] as Key), [1.5, BLUE]],
    [[1.75, BLUE], ...Array.from({ length: 11 }, () => [1, WHITE] as Key), [2.25, BLUE]],
    [[2.25, BLUE], ...Array.from({ length: 10 }, () => [1, WHITE] as Key), [1.75, BLUE], [1, YELLOW]],
    [[1.25, BLUE], [1.25, BLUE], [1.25, BLUE], [6.25, WHITE], [1, BLUE], [1, BLUE], [1, YELLOW], [1, YELLOW], [1, YELLOW]],
  ];
  const pitch = 0.0188;
  const total = rows.reduce((n, r) => n + r.length, 0);
  const caps = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), std({ roughness: 0.55 }), total);
  caps.castShadow = true;
  caps.receiveShadow = true;
  const mtx = new THREE.Matrix4();
  const col = new THREE.Color();
  let i = 0;
  rows.forEach((r, ri) => {
    let u = 0;
    const rowW = r.reduce((s, k) => s + k[0], 0);
    r.forEach(([w, color]) => {
      const cz = (u + w / 2 - rowW / 2) * pitch;
      const cx = (ri - 2.5) * pitch * -1 - 0.001; // row 0 at the back (+x)
      mtx.compose(V(cx, 0.0325, cz), new THREE.Quaternion(), V(0.0166, 0.0095, w * pitch - 0.0022));
      caps.setMatrixAt(i, mtx);
      col.setHex(color);
      caps.setColorAt(i, col);
      i++;
      u += w;
    });
  });
  caps.instanceMatrix.needsUpdate = true;
  if (caps.instanceColor) caps.instanceColor.needsUpdate = true;
  kb.add(caps);
  kb.rotation.z = 0.09; // the back is a little higher
  kb.position.set(-0.238, DESK_Y, -0.021);
  g.add(kb);
  contact(g, -0.238, -0.021, 0.19, 0.38, Math.PI / 2, 0.55);

  // the coiled cable: a helix wound along a path from the back of the keyboard toward the shelf
  const path = new THREE.CatmullRomCurve3([V(-0.172, DESK_Y + 0.012, -0.16), V(-0.12, DESK_Y + 0.006, -0.19), V(-0.06, DESK_Y + 0.006, -0.17), V(0.0, DESK_Y + 0.006, -0.12), V(0.045, DESK_Y + 0.006, -0.12)]);
  const pts: THREE.Vector3[] = [];
  const turns = 22;
  const N = 420;
  const up = V(0, 1, 0);
  for (let s = 0; s <= N; s++) {
    const t = s / N;
    const p = path.getPoint(t);
    const tan = path.getTangent(t);
    const n1 = new THREE.Vector3().crossVectors(tan, up).normalize();
    const n2 = new THREE.Vector3().crossVectors(tan, n1).normalize();
    const a = t * turns * Math.PI * 2;
    pts.push(p.clone().addScaledVector(n1, Math.cos(a) * 0.0075).addScaledVector(n2, Math.sin(a) * 0.0075 + 0.0075));
  }
  g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 900, 0.0026, 6), std({ color: 0x9a9ea2, roughness: 0.55 })));
}

// --- the mouse ---------------------------------------------------------------------------------------------------------------------
function mouse(g: THREE.Group) {
  const m = new THREE.Group();
  // an ergonomic shell: a flattened ellipsoid, high at the back and low at the front
  const shell = new THREE.SphereGeometry(1, 48, 32);
  const p = shell.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i);
    let y = p.getY(i);
    const z = p.getZ(i);
    if (y < 0) y *= 0.15;
    y *= 1 - 0.42 * Math.max(0, z);
    x *= 1 + 0.06 * Math.max(0, -z);
    p.setXYZ(i, x * 0.04, y * 0.021 + 0.002, z * 0.062);
  }
  shell.computeVertexNormals();
  m.add(mesh(shell, std({ color: 0xcfd2d6, roughness: 0.42, metalness: 0.05 })));
  const grip = mesh(new THREE.SphereGeometry(1, 20, 12), std({ color: 0x8f9296, roughness: 0.85 }), 0.034, 0.014, -0.006);
  grip.scale.set(0.012, 0.015, 0.034);
  m.add(grip);
  const wheel = mesh(new THREE.CylinderGeometry(0.0068, 0.0068, 0.009, 24), std({ color: 0x24262a, roughness: 0.35, metalness: 0.6 }), 0, 0.0158, 0.03);
  wheel.rotation.z = Math.PI / 2;
  m.add(wheel);
  m.add(mesh(new THREE.BoxGeometry(0.0009, 0.0006, 0.05), std({ color: 0x70737a }), 0, 0.0238, 0.04));
  for (const z of [0.0, 0.016]) m.add(mesh(new THREE.BoxGeometry(0.003, 0.004, 0.012), std({ color: 0x5e6167, roughness: 0.5 }), 0.0385, 0.018, z));
  m.rotation.y = Math.PI / 2 - 0.15; // its buttons point away from the seat
  m.position.set(-0.21, DESK_Y, 0.19);
  g.add(m);
  contact(g, -0.21, 0.19, 0.1, 0.15, Math.PI / 2 - 0.15, 0.5);
}

// --- the arcade stick: Super Street Fighter IV Arcade FightStick Tournament Edition ----------------------------------------------------
function stick(g: THREE.Group, tex: PropTextures) {
  const s = new THREE.Group();
  const L = 0.362;
  const D = 0.228;
  const H = 0.064;
  s.add(mesh(rbox(L, H, D, 0.014), phys({ color: 0x1b3a9a, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.12 }), 0, H / 2, 0));
  // the face: the a7R photograph of the art plate, flattened, with its cream bezel
  const IW = 2400;
  const IH = 1412;
  const PW = 0.338;
  const PD = PW * (IH / IW);
  const face = flat(PW, PD, std({ map: tex.stickTop, roughness: 0.55, color: 0xe6e6e6, envMapIntensity: 0.35 }), H + 0.0012);
  face.receiveShadow = true;
  s.add(face);
  const toLocal = (px: number, py: number) => V((px / IW - 0.5) * PW, H + 0.0012, (py / IH - 0.5) * PD);
  const jp = toLocal(696, 504);
  s.add(mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.006, 28), std({ color: 0x0e0f12, roughness: 0.5 }), jp.x, jp.y + 0.003, jp.z));
  s.add(mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.034, 12), std({ color: 0x15161a, roughness: 0.3, metalness: 0.8 }), jp.x, jp.y + 0.02, jp.z));
  const ball = mesh(new THREE.SphereGeometry(0.0185, 32, 20), phys({ color: 0xefe6c8, roughness: 0.22, clearcoat: 0.8 }), jp.x, jp.y + 0.043, jp.z);
  ball.scale.set(1, 0.92, 1);
  s.add(ball);
  const btn: [number, number, number][] = [
    [1544, 480, 0xd9e03a],
    [1310, 554, 0x2a62d8],
    [1490, 720, 0xd8222c],
    [1250, 794, 0x26b365],
    [1800, 490, 0xe7e9f5],
    [2050, 500, 0xe7e9f5],
    [1740, 744, 0xe7e9f5],
    [1992, 744, 0xe7e9f5],
  ];
  for (const [px, py, color] of btn) {
    const p = toLocal(px, py);
    s.add(mesh(new THREE.CylinderGeometry(0.0172, 0.0172, 0.004, 28), std({ color: 0x0f1013, roughness: 0.4 }), p.x, p.y + 0.002, p.z));
    s.add(mesh(new THREE.CylinderGeometry(0.0148, 0.0156, 0.0085, 28), phys({ color, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05, transparent: true, opacity: 0.93 }), p.x, p.y + 0.0065, p.z));
  }
  const ang = STICK.deg * (Math.PI / 180);
  s.rotation.y = yawFor(Math.sin(ang), Math.cos(ang));
  s.position.set(STICK.x, DESK_Y, STICK.z);
  g.add(s);
  contact(g, STICK.x, STICK.z, 0.4, 0.3, s.rotation.y, 0.55);

  // its cable, looped behind it
  const cable = new THREE.CatmullRomCurve3([V(STICK.x + 0.12, DESK_Y + 0.02, STICK.z + 0.06), V(STICK.x + 0.15, DESK_Y + 0.004, STICK.z + 0.0), V(STICK.x + 0.22, DESK_Y + 0.004, STICK.z + 0.04), V(STICK.x + 0.2, DESK_Y + 0.004, STICK.z + 0.12), V(STICK.x + 0.27, DESK_Y + 0.004, STICK.z + 0.2)]);
  g.add(mesh(new THREE.TubeGeometry(cable, 120, 0.0032, 6), std({ color: 0x0c0c0e, roughness: 0.6 })));
}

// --- the microphone on its boom arm, over the stick ---------------------------------------------------------------------------------------
function micArm(g: THREE.Group) {
  const black = std({ color: 0x141416, roughness: 0.45, metalness: 0.5 });
  const chrome = std({ color: 0xc9ccd0, roughness: 0.25, metalness: 1 });
  const mic = new THREE.Group();
  const body = mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.16, 28), black);
  body.rotation.z = Math.PI / 2;
  mic.add(body);
  const head = mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.05, 28), std({ color: 0x0c0c0d, roughness: 0.95 }), 0.1, 0, 0); // the foam windscreen
  head.rotation.z = Math.PI / 2;
  mic.add(head);
  const ring = mesh(new THREE.TorusGeometry(0.036, 0.003, 8, 28), chrome, -0.02, 0, 0);
  ring.rotation.y = Math.PI / 2;
  mic.add(ring);
  const dir = V(-0.33, 0, 0.94).normalize();
  mic.rotation.y = yawFor(dir.x, dir.z);
  mic.position.set(-0.305, DESK_Y + 0.2, -0.43);
  g.add(mic);
  // the arm: from a clamp on the left edge of the desk, up and over
  const clamp = V(0.16, DESK_Y, DESK.z0 + 0.02);
  const elbow = V(0.1, DESK_Y + 0.34, -0.62);
  const wrist = V(-0.26, DESK_Y + 0.23, -0.52);
  g.add(mesh(rbox(0.05, 0.1, 0.04, 0.004), black, clamp.x, DESK_Y + 0.0, clamp.z));
  g.add(rod(V(clamp.x, DESK_Y + 0.04, clamp.z), elbow, 0.011, black));
  g.add(mesh(new THREE.SphereGeometry(0.016, 16, 12), chrome, elbow.x, elbow.y, elbow.z));
  g.add(rod(elbow, wrist, 0.009, black));
  g.add(mesh(new THREE.SphereGeometry(0.013, 16, 12), chrome, wrist.x, wrist.y, wrist.z));
  g.add(rod(wrist, V(-0.3, DESK_Y + 0.205, -0.45), 0.007, black));
}

// --- the Street Fighter art book (closed: the cover) --------------------------------------------------------------------------------------
function book(g: THREE.Group, tex: PropTextures) {
  const b = new THREE.Group();
  const W = 0.215;
  const D = W * (1500 / 1100);
  const T = 0.022;
  const paper = std({ color: 0xefece4, roughness: 0.85 });
  const board = std({ color: 0xdedbd2, roughness: 0.6 });
  // the block of pages and the covers, with the paper edge showing
  b.add(mesh(rbox(W - 0.004, T - 0.006, D - 0.006, 0.001), paper, 0, T / 2, 0));
  b.add(mesh(rbox(W, 0.003, D, 0.0012), board, 0, 0.0015, 0));
  b.add(mesh(rbox(W, 0.004, D, 0.0012), board, 0, T - 0.002, 0));
  // the cover's picture lies on the top face, its top toward local -z (away from the seat)
  const face = flat(W, D, std({ map: tex.bookCover, roughness: 0.5, color: 0xe8e8e8, envMapIntensity: 0.3 }), T + 0.0004);
  face.receiveShadow = true;
  b.add(face);
  b.rotation.y = (BOOK.deg * Math.PI) / 180;
  b.position.set(BOOK.x, DESK_Y, BOOK.z);
  g.add(b);
  contact(g, BOOK.x, BOOK.z, 0.3, 0.4, b.rotation.y, 0.45);
}

// --- the Sony deck --------------------------------------------------------------------------------------------------------------------------
function deck(g: THREE.Group, tex: PropTextures): THREE.Group {
  const d = new THREE.Group();
  d.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(LATERAL, V(0, 1, 0), INTO.clone().negate())); // local +z is the front
  d.position.copy(DECK_FRONT);
  const plastic = std({ color: 0x232428, roughness: 0.55, metalness: 0.1 });
  const inner = std({ color: 0x0e0f11, roughness: 0.8 });
  // the base: an open box, so that the cassette bay shows when the lid is up
  const wall = 0.008;
  d.add(mesh(rbox(DECK.w, 0.006, DECK.d, 0.002), inner, 0, 0.003, -DECK.d / 2));
  d.add(mesh(rbox(DECK.w, DECK.h, wall, 0.002), plastic, 0, DECK.h / 2, -wall / 2)); // front
  d.add(mesh(rbox(DECK.w, DECK.h, wall, 0.002), plastic, 0, DECK.h / 2, -DECK.d + wall / 2)); // back
  for (const s of [-1, 1]) d.add(mesh(rbox(wall, DECK.h, DECK.d, 0.002), plastic, s * (DECK.w / 2 - wall / 2), DECK.h / 2, -DECK.d / 2));
  // the mechanism in the bay: a pale metal tray with the tape's guides
  d.add(mesh(rbox(DECK.w - 0.03, 0.012, DECK.d - 0.05, 0.002), std({ color: 0x8a8d92, roughness: 0.35, metalness: 0.85 }), 0, 0.012, -DECK.d / 2 + 0.004));
  d.add(mesh(rbox(0.07, 0.005, 0.034, 0.001), std({ color: 0x2b2d31, roughness: 0.5, metalness: 0.6 }), 0, 0.019, -DECK.d / 2 + 0.03));
  // the front: Sony's row of stickers on dark plastic
  const sw = DECK.w - 0.014;
  const sh = sw * (340 / 1500);
  const sticker = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), std({ map: tex.deckSticker, roughness: 0.6, envMapIntensity: 0.15 }));
  sticker.position.set(0, 0.0075 + sh / 2, 0.0006);
  sticker.receiveShadow = true;
  d.add(sticker);
  g.add(d);
  contact(g, DECK_FRONT.x + INTO.x * 0.07, DECK_FRONT.z, 0.28, 0.28, 0, 0.5);

  // the lid: the top panel with the controls, hinged at the back; it lifts to open the cassette bay
  const lid = new THREE.Group();
  lid.position.set(0, DECK.h, -DECK.d);
  lid.add(mesh(rbox(DECK.w, 0.008, DECK.d, 0.002), plastic, 0, -0.004, DECK.d / 2));
  const top = flat(DECK.w - 0.002, DECK.d - 0.004, std({ map: tex.deckTop, roughness: 0.9, color: 0x9a9690, envMapIntensity: 0.05 }), 0.0006);
  top.position.z = DECK.d / 2;
  lid.add(top);
  d.add(lid);

  // the screen flap: the real flap's face from the photograph, tipped back to the measured angle
  const flap = new THREE.Group();
  flap.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(LCD_RIGHT, LCD_UP, LCD_NORMAL));
  const FH = FLAP.w * (860 / 1002);
  const side = std({ color: 0x232428, roughness: 0.5, metalness: 0.1 });
  const face = std({ map: tex.deckFlap, roughness: 0.75, color: 0xb9b2aa, envMapIntensity: 0.12 });
  flap.add(mesh(rbox(FLAP.w, FH, FLAP.t, 0.004), [side, side, side, side, face, side], 0, 0, -FLAP.t / 2));
  flap.position.copy(LCD_CENTRE).addScaledVector(LCD_RIGHT, 0.005);
  g.add(flap);
  const hinge = mesh(new THREE.CylinderGeometry(0.0065, 0.0065, FLAP.w * 0.82, 16), std({ color: 0x1c1d20, roughness: 0.4, metalness: 0.5 }));
  hinge.quaternion.setFromUnitVectors(V(0, 1, 0), LCD_RIGHT);
  hinge.position.copy(LCD_CENTRE).addScaledVector(LCD_RIGHT, 0.005).addScaledVector(LCD_UP, -(FH / 2 - 0.004)).addScaledVector(LCD_NORMAL, -0.012);
  g.add(hinge);
  return lid;
}

// --- the lamp: blue base, red stem, a glass shade, a bulb ---------------------------------------------------------------------------------
function lamp(g: THREE.Group) {
  g.add(mesh(new THREE.CylinderGeometry(0.066, 0.07, 0.014, 40), std({ color: 0x1f3d9c, roughness: 0.35, metalness: 0.2 }), LAMP.x, DESK_Y + 0.007, LAMP.z));
  g.add(mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.02, 20), std({ color: 0x15161a, roughness: 0.5 }), LAMP.x, DESK_Y + 0.024, LAMP.z));
  const stem = [V(LAMP.x, DESK_Y + 0.02, LAMP.z), V(LAMP.x, DESK_Y + 0.12, LAMP.z + 0.004), V(LAMP.x + 0.004, DESK_Y + 0.2, LAMP.z + 0.02), V(LAMP.bulb.x - 0.012, DESK_Y + 0.25, LAMP.bulb.z - 0.012)];
  g.add(tube(stem, 0.005, std({ color: 0xc2272d, roughness: 0.35 }), 40));
  const b = LAMP.bulb;
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.026, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff4dc }));
  bulb.position.copy(b);
  g.add(bulb);
  const shade = mesh(new THREE.SphereGeometry(0.04, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.62), phys({ color: 0xeef6ff, roughness: 0.05, transparent: true, opacity: 0.18, side: THREE.DoubleSide }), b.x, b.y - 0.006, b.z); // the glass shade
  shade.castShadow = false;
  g.add(shade);
  g.add(mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.03, 20), std({ color: 0xf0c828, roughness: 0.5 }), b.x, b.y + 0.04, b.z)); // its yellow cap
  contact(g, LAMP.x, LAMP.z, 0.2, 0.2, 0, 0.55);
}

// --- the audio interface, the puck, headphones, a loose cassette ----------------------------------------------------------------------------
function odds(g: THREE.Group) {
  const ai = new THREE.Group();
  ai.add(mesh(rbox(0.12, 0.05, 0.2, 0.004), std({ color: 0x15161a, roughness: 0.45, metalness: 0.3 }), 0, 0.025, 0));
  for (const z of [-0.1, 0.1]) ai.add(mesh(rbox(0.121, 0.05, 0.012, 0.002), std({ color: 0xb21c1c, roughness: 0.45, metalness: 0.2 }), 0, 0.025, z));
  for (const z of [-0.06, 0.0, 0.06]) {
    const k = mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.008, 18), std({ color: 0x0a0a0c, roughness: 0.35, metalness: 0.7 }), -0.061, 0.03, z);
    k.rotation.z = Math.PI / 2;
    ai.add(k);
  }
  for (const z of [-0.03, 0.03, 0.045]) {
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.0013, 8, 8), new THREE.MeshBasicMaterial({ color: z > 0.04 ? 0x50ff90 : 0xfff3d0 }));
    led.position.set(-0.0612, 0.016, z);
    ai.add(led);
  }
  ai.position.set(0.04, DESK_Y, 0.31);
  g.add(ai);

  // the round puck beside the deck, and the brown headphones at the back right
  g.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.022, 36), std({ color: 0x2a2b30, roughness: 0.35, metalness: 0.6 }), -0.04, DESK_Y + 0.011, 0.47));
  g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.001, 36), std({ color: 0x3a3c42, roughness: 0.3, metalness: 0.7 }), -0.04, DESK_Y + 0.0225, 0.47));
  g.add(mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.034, 44), std({ color: 0x4a3a30, roughness: 0.4, metalness: 0.6 }), 0.03, DESK_Y + 0.017, 0.57));
  const pad = mesh(new THREE.TorusGeometry(0.05, 0.012, 12, 40), std({ color: 0x2b2420, roughness: 0.8 }), 0.03, DESK_Y + 0.034, 0.57);
  pad.rotation.x = Math.PI / 2;
  g.add(pad);
  const band = mesh(new THREE.TorusGeometry(0.075, 0.008, 10, 40, Math.PI), std({ color: 0x2b2420, roughness: 0.7 }), 0.03, DESK_Y + 0.05, 0.57);
  band.rotation.y = Math.PI / 2;
  g.add(band);

  // a loose Mini DV cassette, lying near the front edge
  const lt = new THREE.CanvasTexture(drawCassette({ id: "loose", title: "", file: "", seconds: 0 }));
  lt.colorSpace = THREE.SRGBColorSpace;
  const dark = std({ color: 0x1b1c20, roughness: 0.5 });
  const cas = mesh(new RoundedBoxGeometry(0.066, 0.048, 0.0122, 2, 0.0016), [dark, dark, dark, dark, std({ map: lt, roughness: 0.45 }), dark]);
  cas.rotation.x = -Math.PI / 2; // label up
  cas.rotation.z = 0.35;
  cas.position.set(-0.36, DESK_Y + 0.0062, -0.26);
  g.add(cas);
  contact(g, -0.36, -0.26, 0.11, 0.09, 0.35, 0.5);
}

export function buildProps(tex: PropTextures): Props {
  const g = new THREE.Group();
  room(g);
  shelf(g, tex);
  monitor(g);
  keyboard(g);
  mouse(g);
  stick(g, tex);
  micArm(g);
  book(g, tex);
  const deckLid = deck(g, tex);
  lamp(g);
  odds(g);
  return { group: g, deckLid };
}
