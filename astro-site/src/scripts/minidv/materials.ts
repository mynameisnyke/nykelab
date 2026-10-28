// Procedural surfaces (bamboo, oak, plaster, soft shadows) and a loader for the photographs that texture the props.
import * as THREE from "three";

export function loadTex(url: string, color = true): Promise<THREE.Texture> {
  return new Promise((resolve, reject) =>
    new THREE.TextureLoader().load(
      url,
      (t) => {
        t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        t.anisotropy = 8;
        resolve(t);
      },
      undefined,
      () => reject(new Error(`could not load ${url}`)),
    ),
  );
}

const rng = (seed: number) => () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};

/** Strips of laminated wood running along the canvas' vertical axis; returns the colour and a matching roughness map. */
function strips(base: string[], seed: number, stripPx: number, grain: number): { map: THREE.CanvasTexture; rough: THREE.CanvasTexture } {
  const W = 1024;
  const r = rng(seed);
  const c = document.createElement("canvas");
  c.width = c.height = W;
  const g = c.getContext("2d")!;
  const rc = document.createElement("canvas");
  rc.width = rc.height = W;
  const rg = rc.getContext("2d")!;
  rg.fillStyle = "#8c8c8c";
  rg.fillRect(0, 0, W, W);
  for (let x = 0; x < W; x += stripPx) {
    const col = base[Math.floor(r() * base.length)];
    g.fillStyle = col;
    g.fillRect(x, 0, stripPx, W);
    g.fillStyle = `rgba(${r() > 0.5 ? "255,236,200" : "90,58,28"},${0.05 + r() * 0.09})`;
    g.fillRect(x, 0, stripPx, W);
    // the seam between two strips
    g.fillStyle = "rgba(70,44,20,0.35)";
    g.fillRect(x, 0, 1.5, W);
    // grain, long and faint
    for (let i = 0; i < grain; i++) {
      const gx = x + r() * stripPx;
      const gy = r() * W;
      const len = 40 + r() * 260;
      g.fillStyle = `rgba(${r() > 0.5 ? "255,240,210" : "80,50,20"},${0.03 + r() * 0.07})`;
      g.fillRect(gx, gy, 1 + r() * 1.4, len);
      rg.fillStyle = `rgba(${r() > 0.5 ? "190,190,190" : "90,90,90"},0.12)`;
      rg.fillRect(gx, gy, 1.4, len);
    }
    // a node now and then, as bamboo has
    for (let n = 0; n < 2; n++) {
      if (r() < 0.55) {
        const ny = r() * W;
        g.fillStyle = "rgba(90,58,28,0.28)";
        g.fillRect(x + 1, ny, stripPx - 2, 3);
      }
    }
  }
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 8;
  const rough = new THREE.CanvasTexture(rc);
  rough.wrapS = rough.wrapT = THREE.RepeatWrapping;
  return { map, rough };
}

/** the bamboo desk: ~14 mm strips; the texture covers 0.6 m */
export const bamboo = () => strips(["#a26a39", "#ad7441", "#985f31", "#a76e3b", "#b37a45"], 11, 24, 220);
/** the oak shelf: wider, paler boards */
export const oak = () => strips(["#c99d62", "#c19459", "#d1a56b", "#c6995e"], 29, 90, 160);

/** plain plaster with a little unevenness */
export function plaster(): THREE.CanvasTexture {
  const W = 512;
  const r = rng(5);
  const c = document.createElement("canvas");
  c.width = c.height = W;
  const g = c.getContext("2d")!;
  g.fillStyle = "#e4ddd0";
  g.fillRect(0, 0, W, W);
  // a faint, fine grain only: a painted wall, not a stucco one
  for (let i = 0; i < 6000; i++) {
    g.fillStyle = `rgba(${r() > 0.5 ? "255,252,245" : "150,138,120"},${0.012 + r() * 0.018})`;
    g.fillRect(r() * W, r() * W, 1 + r() * 3, 1 + r() * 3);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** a soft dark patch, for the contact shadow under a thing on the desk */
export function blobTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.shadowColor = "rgba(0,0,0,1)";
  g.shadowBlur = 26;
  g.shadowOffsetX = 1000; // drawn off the canvas; only its shadow lands here
  g.fillStyle = "#000";
  g.fillRect(34 - 1000, 34, 60, 60);
  return new THREE.CanvasTexture(c);
}

/** a soft round glow (the LCD's light on the desk) */
export function glowTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const r = g.createRadialGradient(64, 64, 2, 64, 64, 64);
  r.addColorStop(0, "rgba(170,195,255,0.85)");
  r.addColorStop(0.4, "rgba(120,155,255,0.25)");
  r.addColorStop(1, "rgba(90,120,255,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
