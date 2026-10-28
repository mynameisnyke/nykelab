// The paper on a Mini DV tape, drawn on canvases: the insert card in its clear case (printed header, the title written by hand) and
// the cassette's own label. Ratio 66 x 48 mm. Nothing cartoonish: off-white paper with a little grain, ballpoint ink that wobbles.
import type { Tape } from "../../lib/minidv";

export const ART_W = 768;
export const ART_H = 558;

const HAND = `"Bradley Hand", "Segoe Print", "Noteworthy", "Marker Felt", "Comic Sans MS", cursive`;
const UI = `"Inter Variable", "Inter", system-ui, sans-serif`;
const INKS = ["#1b2a5e", "#16171c", "#233a7a", "#2b1f1f"];

/** the same tape always gets the same pen and slant */
const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
};
const rng = (seed: number) => () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};

function canvas() {
  const c = document.createElement("canvas");
  c.width = ART_W;
  c.height = ART_H;
  return [c, c.getContext("2d")!] as const;
}

/** writes a line letter by letter so no two letters sit quite alike, the way a pen does */
function write(g: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, ink: string, rand: () => number) {
  g.save();
  g.fillStyle = ink;
  g.textBaseline = "alphabetic";
  let cx = x;
  for (const ch of text) {
    const s = size * (0.97 + rand() * 0.06);
    g.font = `${s}px ${HAND}`;
    g.save();
    g.translate(cx, y + (rand() - 0.5) * size * 0.07);
    g.rotate((rand() - 0.5) * 0.07);
    g.globalAlpha = 0.84 + rand() * 0.12;
    g.fillText(ch, 0, 0);
    g.restore();
    cx += g.measureText(ch).width + size * 0.012;
  }
  g.restore();
  return cx - x;
}

function lineWidth(g: CanvasRenderingContext2D, text: string, size: number) {
  g.font = `${size}px ${HAND}`;
  return g.measureText(text).width + text.length * size * 0.012;
}

function fitLines(g: CanvasRenderingContext2D, text: string, maxW: number, maxH: number, start: number): { lines: string[]; size: number } {
  for (let size = start; size >= 26; size -= 3) {
    const lines: string[] = [];
    let line = "";
    for (const word of text.split(" ")) {
      const next = line ? `${line} ${word}` : word;
      if (line && lineWidth(g, next, size) > maxW) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) lines.push(line);
    if (lines.length * size * 1.12 <= maxH && lines.every((l) => lineWidth(g, l, size) <= maxW)) return { lines, size };
  }
  return { lines: [text], size: 26 };
}

function paper(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rand: () => number) {
  g.fillStyle = "#ebe8df";
  g.fillRect(x, y, w, h);
  // a little grain and uneven light
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(${rand() > 0.5 ? "90,84,70" : "255,255,250"},${0.025 + rand() * 0.05})`;
    g.fillRect(x + rand() * w, y + rand() * h, 1 + rand() * 1.6, 1 + rand() * 1.6);
  }
  const shade = g.createLinearGradient(x, y, x + w, y + h);
  shade.addColorStop(0, "rgba(255,255,255,0.10)");
  shade.addColorStop(1, "rgba(60,50,30,0.12)");
  g.fillStyle = shade;
  g.fillRect(x, y, w, h);
}

/** The card in the clear case: what you read when the tape stands in the drawer. The title starts at the top so it shows over the tape in front. */
export function drawInsert(tape: Tape): HTMLCanvasElement {
  const [c, g] = canvas();
  const r = rng(Math.floor(hash(tape.id) * 4294967295));
  paper(g, 0, 0, ART_W, ART_H, r);

  // printed header: TITLE ... REC. MODE [ ]LP [ ]SP ... DATE
  g.fillStyle = "#7d7a70";
  g.font = `600 17px ${UI}`;
  g.textBaseline = "alphabetic";
  g.fillText("TITLE", 26, 33);
  g.textAlign = "right";
  g.fillText("DATE", ART_W - 26, 33);
  g.fillText("REC. MODE", ART_W - 262, 33);
  g.textAlign = "left";
  g.strokeStyle = "#7d7a70";
  g.lineWidth = 1.6;
  g.strokeRect(ART_W - 246, 19, 14, 14);
  g.strokeRect(ART_W - 178, 19, 14, 14);
  g.font = `600 15px ${UI}`;
  g.fillText("LP", ART_W - 226, 33);
  g.fillText("SP", ART_W - 158, 33);
  g.strokeStyle = "#a9a699";
  g.lineWidth = 1.4;
  g.beginPath();
  g.moveTo(18, 46);
  g.lineTo(ART_W - 18, 46);
  g.stroke();
  // ruled lines
  g.strokeStyle = "rgba(120,130,150,0.28)";
  g.lineWidth = 1.2;
  for (let y = 112; y < ART_H - 20; y += 52) {
    g.beginPath();
    g.moveTo(18, y);
    g.lineTo(ART_W - 18, y);
    g.stroke();
  }

  // the title, in ballpoint, top-left, as big as fits
  const ink = INKS[Math.floor(hash(tape.id) * INKS.length)];
  const { lines, size } = fitLines(g, tape.note ? `${tape.title} ${tape.note}` : tape.title, ART_W - 90, ART_H - 130, 92);
  let y = 62 + size * 0.86;
  for (const line of lines) {
    write(g, line, 34 + r() * 6, y, size, ink, r);
    y += size * 1.12;
  }
  // a tick in the SP box
  g.save();
  g.strokeStyle = ink;
  g.globalAlpha = 0.85;
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(ART_W - 175, 28);
  g.lineTo(ART_W - 170, 36);
  g.lineTo(ART_W - 158, 14);
  g.stroke();
  g.restore();
  return c;
}

/** The cassette itself, label side up: the dark shell, the printed label with the Mini DV mark, the title written on it. */
export function drawCassette(tape: Tape): HTMLCanvasElement {
  const [c, g] = canvas();
  const r = rng(Math.floor(hash(tape.id + "c") * 4294967295));
  const shell = g.createLinearGradient(0, 0, ART_W, ART_H);
  shell.addColorStop(0, "#2d2e33");
  shell.addColorStop(1, "#17181b");
  g.fillStyle = shell;
  g.fillRect(0, 0, ART_W, ART_H);
  for (let i = 0; i < 2200; i++) {
    g.fillStyle = `rgba(255,255,255,${0.012 + r() * 0.03})`;
    g.fillRect(r() * ART_W, r() * ART_H, 1.4, 1.4);
  }

  // label panel
  const lx = 44;
  const ly = 34;
  const lw = ART_W - 88;
  const lh = 316;
  paper(g, lx, ly, lw, lh, r);
  g.strokeStyle = "rgba(0,0,0,0.25)";
  g.lineWidth = 2;
  g.strokeRect(lx, ly, lw, lh);

  // printed: Mini DV mark, SONY, the spec line
  g.fillStyle = "#14151a";
  g.textBaseline = "alphabetic";
  g.font = `italic 700 34px ${UI}`;
  g.fillText("Mini", lx + 20, ly + 56);
  g.font = `italic 900 58px "Playfair Display Variable", "Playfair Display", serif`;
  g.fillText("DV", lx + 96, ly + 58);
  g.font = `800 26px ${UI}`;
  g.textAlign = "right";
  g.fillText("SONY", lx + lw - 20, ly + 50);
  g.textAlign = "left";
  g.fillStyle = "#6c695f";
  g.font = `600 13px ${UI}`;
  g.fillText("DIGITAL VIDEO CASSETTE   60min SP / 90min LP", lx + 20, ly + 86);
  g.strokeStyle = "rgba(120,130,150,0.3)";
  g.lineWidth = 1.2;
  [140, 192, 244, 296].forEach((dy) => {
    g.beginPath();
    g.moveTo(lx + 12, ly + dy);
    g.lineTo(lx + lw - 12, ly + dy);
    g.stroke();
  });

  const ink = INKS[Math.floor(hash(tape.id) * INKS.length)];
  const { lines, size } = fitLines(g, tape.note ? `${tape.title} ${tape.note}` : tape.title, lw - 60, 190, 64);
  let y = ly + 104 + size * 0.9;
  for (const line of lines) {
    write(g, line, lx + 26 + r() * 5, y, size, ink, r);
    y += size * 1.12;
  }

  // lower shell: the tape window and the write-protect tab
  g.fillStyle = "#08090b";
  g.beginPath();
  g.roundRect(lx + 6, ly + lh + 30, 230, 70, 10);
  g.fill();
  g.fillStyle = "#4a3a2a";
  g.fillRect(lx + 20, ly + lh + 46, 202, 36);
  g.fillStyle = "#101012";
  [lx + 84, lx + 160].forEach((cx) => {
    g.beginPath();
    g.arc(cx, ly + lh + 64, 14, 0, Math.PI * 2);
    g.fill();
  });
  g.fillStyle = "#c9cbd0";
  g.fillRect(ART_W - 120, ly + lh + 52, 66, 24);
  g.fillStyle = "#101012";
  g.fillRect(ART_W - 112, ly + lh + 58, 14, 12);
  const sheen = g.createLinearGradient(0, 0, ART_W * 0.7, ART_H * 0.7);
  sheen.addColorStop(0, "rgba(255,255,255,0.10)");
  sheen.addColorStop(0.5, "rgba(255,255,255,0)");
  g.fillStyle = sheen;
  g.fillRect(0, 0, ART_W, ART_H);
  return c;
}

/** The cassette's top edge (66 x 12 mm): where the name is written, so a stack of tapes can be read from above, as in the drawer. */
export function drawEdge(tape: Tape): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 190;
  const g = c.getContext("2d")!;
  const r = rng(Math.floor(hash(tape.id + "e") * 4294967295));
  g.fillStyle = "#222327";
  g.fillRect(0, 0, 1024, 190);
  // the paper label along the edge
  paper(g, 28, 22, 968, 146, r);
  g.strokeStyle = "rgba(0,0,0,0.25)";
  g.lineWidth = 2;
  g.strokeRect(28, 22, 968, 146);
  g.fillStyle = "#8a877c";
  g.font = `700 22px ${UI}`;
  g.textBaseline = "alphabetic";
  g.textAlign = "right";
  g.fillText("SONY  Mini DV", 984, 154);
  g.textAlign = "left";
  const ink = INKS[Math.floor(hash(tape.id) * INKS.length)];
  const title = tape.note ? `${tape.title}, ${tape.note}` : tape.title;
  let size = 108;
  while (size > 40 && lineWidth(g, title, size) > 700) size -= 4;
  write(g, title, 52, 112, size, ink, r);
  return c;
}
