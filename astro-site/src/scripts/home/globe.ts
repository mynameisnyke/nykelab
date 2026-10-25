// WHERE: a three.js globe. Land is drawn as dots, each voyage is a stem + bloom of its
// photographs, voyages are joined by arcs in date order. d3-geo rasterises the land mask.
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { geoEquirectangular, geoPath } from "d3";
import { feature } from "topojson-client";
import landTopo from "world-atlas/land-110m.json";
import { latLonToVec } from "../../lib/voyages";
import type { Store } from "./store";

const FOV = 35;

function cssHex(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return /^#[0-9a-f]{6}$/i.test(v) ? v : fallback;
}

/** Land dots: sample a Fibonacci sphere, keep points that fall on land in an equirectangular mask. */
function landDots(n: number): Float32Array {
  const W = 1024;
  const H = 512;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d", { willReadFrequently: true })!;
  g.fillStyle = "#000";
  g.fillRect(0, 0, W, H);
  g.fillStyle = "#fff";
  g.beginPath();
  const topo = landTopo as any;
  geoPath(geoEquirectangular().scale(W / (2 * Math.PI)).translate([W / 2, H / 2]), g)(feature(topo, topo.objects.land) as any);
  g.fill();
  const px = g.getImageData(0, 0, W, H).data;

  const out: number[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = golden * i;
    const x = Math.cos(th) * r;
    const z = Math.sin(th) * r;
    const lat = (Math.asin(y) * 180) / Math.PI;
    const lon = (Math.atan2(x, z) * 180) / Math.PI;
    const ix = Math.min(W - 1, Math.floor(((lon + 180) / 360) * W));
    const iy = Math.min(H - 1, Math.floor(((90 - lat) / 180) * H));
    if (px[(iy * W + ix) * 4] > 128) out.push(x, y, z);
  }
  return new Float32Array(out);
}

function glowTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.35, "rgba(255,255,255,0.85)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

interface VObj {
  idx: number;
  base: THREE.Vector3;
  tip: THREE.Vector3;
  stem: THREE.Line;
  tipPts: THREE.Points;
  bloom: THREE.Points;
  ring: THREE.LineLoop;
  level: number; // current opacity multiplier (eased)
}

export function createGlobe(canvas: HTMLCanvasElement, store: Store) {
  const { voyages, shots } = store.data;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio));
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 50);
  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.55;
  controls.autoRotate = !reduced;
  controls.autoRotateSpeed = 0.45;
  // OrbitControls claims all touch gestures; let vertical swipes scroll the page past the globe.
  canvas.style.touchAction = "pan-y";

  let dist = 4;
  const glow = glowTexture();
  const disposables: { dispose(): void }[] = [glow];

  // -- globe body ---------------------------------------------------------------
  const world = new THREE.Group();
  scene.add(world);

  const sphereMat = new THREE.MeshBasicMaterial({ color: 0x161616 });
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.995, 64, 48), sphereMat);
  world.add(sphere);

  const dotGeo = new THREE.BufferGeometry();
  dotGeo.setAttribute("position", new THREE.BufferAttribute(landDots(16000), 3));
  const dotMat = new THREE.PointsMaterial({ size: 1.5, sizeAttenuation: false, transparent: true, opacity: 0.5, depthWrite: false });
  world.add(new THREE.Points(dotGeo, dotMat));

  const atmoMat = new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { uColor: { value: new THREE.Color(0xffffff) }, uAlpha: { value: 0.22 } },
    vertexShader: "varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: "varying vec3 vN; uniform vec3 uColor; uniform float uAlpha; void main(){ float i = pow(0.68 - dot(vN, vec3(0.0,0.0,1.0)), 3.0); gl_FragColor = vec4(uColor, clamp(i,0.0,1.0) * uAlpha); }",
  });
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(1.14, 64, 48), atmoMat);
  scene.add(atmo);
  disposables.push(sphereMat, sphere.geometry, dotGeo, dotMat, atmoMat, atmo.geometry);

  // -- voyages: stem + tip + bloom of photographs + hover ring -------------------
  const maxCount = Math.max(...voyages.map((v) => v.count));
  const vobjs: VObj[] = voyages.map((v, idx) => {
    const color = new THREE.Color(v.color);
    const base = new THREE.Vector3(...latLonToVec(v.lat, v.lon, 1.002));
    const tip = base.clone();

    const stemGeo = new THREE.BufferGeometry().setFromPoints([base, tip]);
    const stem = new THREE.Line(stemGeo, new THREE.LineBasicMaterial({ color, transparent: true }));

    const tipGeo = new THREE.BufferGeometry().setFromPoints([tip]);
    const tipPts = new THREE.Points(
      tipGeo,
      new THREE.PointsMaterial({ color, size: 16, sizeAttenuation: false, map: glow, transparent: true, depthWrite: false }),
    );

    const bloom = new THREE.Points(
      new THREE.BufferGeometry(),
      new THREE.PointsMaterial({ color, size: 5, sizeAttenuation: false, map: glow, transparent: true, depthWrite: false }),
    );

    const ringPts = Array.from({ length: 48 }, (_, i) => {
      const a = (i / 48) * Math.PI * 2;
      return new THREE.Vector3(Math.cos(a) * 0.045, Math.sin(a) * 0.045, 0);
    });
    const ring = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(ringPts),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 }),
    );
    ring.position.copy(base);
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), base.clone().normalize());
    ring.visible = false;

    world.add(stem, tipPts, bloom, ring);
    disposables.push(stemGeo, stem.material, tipGeo, tipPts.material, bloom.geometry, bloom.material, ring.geometry, ring.material);
    return { idx, base, tip, stem, tipPts, bloom, ring, level: 1 };
  });

  /** Rebuild stems/blooms for the current filter (stems shrink as photographs are filtered out). */
  function refresh() {
    vobjs.forEach((o) => {
      const mine = shots.filter((s) => s.v === o.idx && store.visible(s));
      const h = mine.length ? 0.05 + 0.15 * Math.sqrt(mine.length / maxCount) : 0.02;
      o.tip.copy(o.base).normalize().multiplyScalar(1.002 + h);
      o.stem.geometry.setFromPoints([o.base, o.tip]);
      o.tipPts.geometry.setFromPoints([o.tip]);
      o.bloom.geometry.setFromPoints(mine.map((s) => new THREE.Vector3(...latLonToVec(s.lat, s.lon, 1.004))));
    });
  }

  // -- arcs between voyages, in date order ---------------------------------------
  const arcs: THREE.Line[] = [];
  const byDate = voyages.map((_, i) => i).sort((a, b) => voyages[a].start - voyages[b].start);
  for (let i = 0; i < byDate.length - 1; i++) {
    const a = vobjs[byDate[i]].base;
    const b = vobjs[byDate[i + 1]].base;
    const angle = a.angleTo(b);
    const mid = a.clone().add(b).normalize().multiplyScalar(1 + 0.12 + 0.38 * (angle / Math.PI));
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    const pts = curve.getPoints(64);
    const ca = new THREE.Color(voyages[byDate[i]].color);
    const cb = new THREE.Color(voyages[byDate[i + 1]].color);
    const colors = new Float32Array(pts.length * 3);
    pts.forEach((_, k) => new THREE.Color().lerpColors(ca, cb, k / (pts.length - 1)).toArray(colors, k * 3));
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false });
    const line = new THREE.Line(geo, mat);
    world.add(line);
    arcs.push(line);
    disposables.push(geo, mat);
  }

  // -- theme ----------------------------------------------------------------------
  function applyTheme() {
    const ink = new THREE.Color(cssHex("--text-primary", "#f2f2f2"));
    const light = document.documentElement.dataset.theme === "light";
    sphereMat.color.set(cssHex("--bg-surface", "#161616"));
    dotMat.color.copy(ink);
    dotMat.opacity = light ? 0.55 : 0.5;
    atmoMat.uniforms.uColor.value.copy(ink);
    atmoMat.uniforms.uAlpha.value = light ? 0.14 : 0.22;
  }
  applyTheme();
  const themeObserver = new MutationObserver(applyTheme);
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  // -- sizing ---------------------------------------------------------------------
  function resize() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Fit the globe at ~66% of the smaller side (leaves room for stems and labels).
    const visibleH = (2 / 0.66) * Math.max(1, h / w);
    dist = visibleH / 2 / Math.tan((FOV * Math.PI) / 360);
    camera.position.setLength(dist);
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  // Start facing the newest voyage.
  const newest = voyages.reduce((a, v, i) => (v.start > voyages[a].start ? i : a), 0);
  camera.position.copy(vobjs[newest].base).normalize().multiplyScalar(dist);
  resize();
  refresh();

  // -- interaction ------------------------------------------------------------------
  let dragging = false;
  controls.addEventListener("start", () => (dragging = true));
  controls.addEventListener("end", () => (dragging = false));

  const tmp = new THREE.Vector3();
  const camDir = new THREE.Vector3();
  function pick(clientX: number, clientY: number): number | null {
    const rect = canvas.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;
    camDir.copy(camera.position).normalize();
    let best: number | null = null;
    let bestD = 34;
    for (const o of vobjs) {
      if (o.base.dot(camDir) < 0.18) continue; // far side
      tmp.copy(o.tip).applyMatrix4(world.matrixWorld).project(camera);
      const d = Math.hypot(((tmp.x + 1) / 2) * rect.width - mx, ((1 - tmp.y) / 2) * rect.height - my);
      if (d < bestD) {
        bestD = d;
        best = o.idx;
      }
    }
    return best;
  }

  let down: { x: number; y: number; type: string } | null = null;
  const onMove = (e: PointerEvent) => {
    if (dragging || e.pointerType === "touch") return;
    const p = pick(e.clientX, e.clientY);
    canvas.style.cursor = p !== null && voyages[p].available ? "pointer" : p !== null ? "default" : "grab";
    store.set({ hoverV: p, hoverShot: null });
  };
  const onLeave = () => store.set({ hoverV: null });
  const onDown = (e: PointerEvent) => (down = { x: e.clientX, y: e.clientY, type: e.pointerType });
  const onUp = (e: PointerEvent) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
    const p = pick(e.clientX, e.clientY);
    if (down.type === "touch") store.set({ pinV: p, hoverV: null, hoverShot: null });
    else if (p !== null && voyages[p].available) location.assign(`/${voyages[p].collection}`);
    down = null;
  };
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerleave", onLeave);
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointerup", onUp);

  // -- loop -------------------------------------------------------------------------
  let raf = 0;
  let last = performance.now();
  const t0 = last;
  const focus = new THREE.Vector3();
  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    if (document.hidden) {
      last = now;
      return;
    }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const active = store.activeV();

    // Draw the arcs in, once.
    const intro = reduced ? 1 : Math.min(1, (now - t0) / 2400);
    arcs.forEach((a) => a.geometry.setDrawRange(0, Math.floor(intro * 65)));

    // Ease toward the hovered/pinned voyage; otherwise drift.
    if (active !== null && !dragging) {
      controls.autoRotate = false;
      focus.copy(vobjs[active].base).normalize();
      camDir.copy(camera.position).normalize().lerp(focus, 1 - Math.exp(-dt * 3)).normalize();
      camera.position.copy(camDir.multiplyScalar(dist));
    } else {
      controls.autoRotate = !reduced && !dragging;
    }
    controls.update();

    vobjs.forEach((o) => {
      const share = shots.some((s) => s.v === o.idx && store.visible(s)) ? 1 : 0.12;
      const target = (active === null || active === o.idx ? 1 : 0.22) * share;
      o.level += (target - o.level) * (1 - Math.exp(-dt * 8));
      (o.stem.material as THREE.LineBasicMaterial).opacity = o.level;
      (o.tipPts.material as THREE.PointsMaterial).opacity = o.level;
      (o.bloom.material as THREE.PointsMaterial).opacity = 0.9 * o.level;
      o.ring.visible = active === o.idx;
      if (o.ring.visible) o.ring.scale.setScalar(1 + 0.3 * Math.sin((now - t0) / 260));
    });
    renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(frame);

  const unsub = store.subscribe(refresh);

  return {
    destroy() {
      cancelAnimationFrame(raf);
      unsub();
      ro.disconnect();
      themeObserver.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerup", onUp);
      controls.dispose();
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
    },
  };
}
