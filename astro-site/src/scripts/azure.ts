// Infinite Azure: an endless scroll of photographs laid over a looping sky.
//  - the best of each trip first, then everything else, shuffled; it never runs out
//  - each "scene" lays out one to three photographs that overlap, tilt a little and drift at their own speeds (parallax)
//  - the first time a photograph is mostly on screen it lands with a hit flash (azure-hit.ts) and a small shake
//  - music starts from the Enter button (browsers only allow sound after a click)
import { createHits } from "./azure-hit";

type Item = [id: string, w: number, h: number, place: string, best: 0 | 1, rev: number];
interface Piece {
  item: Item;
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
  speed: number;
  z: number;
  el?: HTMLElement;
}
interface Scene {
  top: number;
  h: number;
  pieces: Piece[];
  el: HTMLElement;
  mounted: boolean;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const shuffle = <T,>(list: T[]) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const portrait = (i: Item) => i[2] > i[1];

export function initAzure(): () => void {
  const root = document.getElementById("az-feed");
  const data = document.getElementById("az-data");
  if (!root || !data) return () => {};
  const items = JSON.parse(data.textContent ?? "[]") as Item[];
  if (!items.length) return () => {};

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const stage = document.getElementById("az-stage")!;
  const bg = document.getElementById("az-bg") as HTMLVideoElement | null;
  const audio = document.getElementById("az-audio") as HTMLAudioElement;
  const intro = document.getElementById("az-intro") as HTMLElement;
  const soundBtn = document.getElementById("az-sound") as HTMLButtonElement;
  const hits = createHits(document.getElementById("az-hit") as HTMLCanvasElement);
  const combo = document.getElementById("az-combo")!;
  const comboN = document.getElementById("az-combo-n")!;
  const cleanups: (() => void)[] = [];
  const listen = <K extends keyof WindowEventMap>(type: K, fn: (e: WindowEventMap[K]) => void, opts?: AddEventListenerOptions) => {
    window.addEventListener(type, fn as EventListener, opts);
    cleanups.push(() => window.removeEventListener(type, fn as EventListener));
  };

  if (reduced && bg) bg.pause(); // the poster frame stays

  // ---- what to show next: the best first, then everyone, forever ---------------------------------------------------------
  let deck: Item[] = [...shuffle(items.filter((i) => i[4] === 1)), ...shuffle(items.filter((i) => i[4] === 0))];
  const refill = () => {
    const last = deck.at(-1);
    deck = shuffle(items);
    if (last && deck[0] === last) deck.push(deck.shift()!);
  };
  /** The next photograph, preferring one with the wanted orientation among the next few. */
  function pull(prefer?: "portrait" | "landscape"): Item {
    if (deck.length < 8) refill();
    if (prefer) {
      const k = deck.slice(0, 14).findIndex((i) => portrait(i) === (prefer === "portrait"));
      if (k >= 0) return deck.splice(k, 1)[0];
    }
    return deck.shift()!;
  }

  // ---- layouts -------------------------------------------------------------------------------------------------------------
  const viewport = () => ({ W: window.innerWidth, H: window.innerHeight });
  const fit = (item: Item, width: number, maxH: number) => {
    let w = width;
    let h = (w * item[2]) / item[1];
    if (h > maxH) {
      h = maxH;
      w = (h * item[1]) / item[2];
    }
    return { w, h };
  };
  const place = (item: Item, width: number, maxH: number, x: number, y: number, rot: number, speed: number, z: number): Piece => ({ item, ...fit(item, width, maxH), x, y, rot, speed: reduced ? 0 : speed, z });

  const TEMPLATES = ["hero", "pair", "stair", "diptych", "solo"] as const;
  let lastTemplate = "";
  function layout(): Piece[] {
    const { W, H } = viewport();
    if (W < 768) return layoutNarrow(W, H);
    let name: (typeof TEMPLATES)[number];
    do name = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)];
    while (name === lastTemplate);
    lastTemplate = name;
    const j = (v: number) => v * rand(-1, 1);
    switch (name) {
      case "hero": {
        // one tall photograph in the middle with smaller ones tucked round its edges
        const main = place(pull("portrait"), W * 0.34, H * 0.88, 0, H * 0.14, j(1.2), 0.04, 3);
        main.x = (W - main.w) / 2 + j(W * 0.03);
        const a = place(pull(), W * 0.2, H * 0.4, main.x - W * 0.17 + j(W * 0.02), H * 0.04, -2.2, 0.15, 2);
        const b = place(pull(), W * 0.21, H * 0.42, main.x + main.w - W * 0.05, H * 0.3, 2.4, 0.19, 4);
        const c = place(pull(), W * 0.2, H * 0.4, main.x - W * 0.1, main.y + main.h * 0.74, -1.4, 0.11, 4);
        return [a, main, b, c];
      }
      case "pair": {
        // two wide photographs stacked at an angle
        const back = place(pull("landscape"), W * 0.58, H * 0.7, W * 0.07 + j(W * 0.02), H * 0.06, -2, 0.07, 1);
        const front = place(pull("landscape"), W * 0.52, H * 0.66, W * 0.4 + j(W * 0.02), back.y + back.h * 0.62, 1.6, -0.03, 2);
        return [back, front];
      }
      case "stair": {
        // three stepping down the page, each overlapping the last
        const w = W * 0.3;
        const a = place(pull(), w, H * 0.6, W * 0.06, H * 0.04, -1.5, 0.12, 1);
        const b = place(pull(), w, H * 0.6, W * 0.33, a.y + a.h * 0.55, 1.2, 0, 2);
        const c = place(pull(), w, H * 0.6, W * 0.6, b.y + b.h * 0.55, -0.8, 0.15, 3);
        return [a, b, c];
      }
      case "diptych": {
        const left = place(pull("portrait"), W * 0.3, H * 0.86, W * 0.1 + j(W * 0.02), H * 0.05, -1.2, 0.1, 2);
        const right = place(pull("landscape"), W * 0.5, H * 0.62, left.x + left.w - W * 0.05, H * 0.28, 1.6, -0.05, 1);
        return [right, left];
      }
      default: {
        const it = pull();
        const p = place(it, portrait(it) ? W * 0.4 : W * 0.66, H * 0.92, 0, H * 0.14, j(1), 0.08, 1);
        p.x = (W - p.w) / 2 + j(W * 0.04);
        return [p];
      }
    }
  }
  function layoutNarrow(W: number, H: number): Piece[] {
    const n = 2 + Math.floor(Math.random() * 2);
    const out: Piece[] = [];
    let y = H * 0.08;
    for (let k = 0; k < n; k++) {
      const it = pull(k % 2 ? "landscape" : "portrait");
      const left = k % 2 === 0;
      const p = place(it, W * rand(0.66, 0.84), H * 0.7, 0, y, rand(-1.8, 1.8), 0.05 + 0.05 * k, k + 1);
      p.x = left ? W * rand(0.03, 0.08) : W - p.w - W * rand(0.03, 0.08);
      out.push(p);
      y += p.h * 0.84;
    }
    return out;
  }

  // ---- scenes ------------------------------------------------------------------------------------------------------------------
  const scenes: Scene[] = [];
  let nextTop = 0;
  let firstScene = true;

  /** A replaced photograph (rev > 1) is asked for by its revision, so the old cached picture is never used. */
  const variant = (item: Item, w: number) => `/m/${item[0]}/w${w}.webp${item[5] > 1 ? `?r=${item[5]}` : ""}`;
  function srcset(item: Item) {
    const out: string[] = [];
    for (const w of [480, 900, 1440, 2400]) {
      out.push(`${variant(item, w)} ${Math.min(w, item[1])}w`);
      if (w >= item[1]) break;
    }
    return out.join(", ");
  }

  function addScene() {
    const { H } = viewport();
    const pieces = layout();
    const bottom = Math.max(...pieces.map((p) => p.y + p.h));
    const h = Math.round(Math.max(H * 1.05, bottom + H * 0.32));
    const el = document.createElement("section");
    el.className = "az-scene";
    el.style.height = `${h}px`;
    root!.appendChild(el);
    const scene: Scene = { top: nextTop, h, pieces, el, mounted: false };
    nextTop += h;
    scenes.push(scene);
    mount(scene, firstScene);
    firstScene = false;
  }

  const landing = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        landing.unobserve(e.target);
        land(e.target as HTMLElement);
      }
    },
    { threshold: 0.35 },
  );

  function mount(scene: Scene, eager = false) {
    if (scene.mounted) return;
    scene.mounted = true;
    for (const p of scene.pieces) {
      const fig = document.createElement("figure");
      fig.className = "az-piece";
      fig.style.cssText = `left:${p.x}px;top:${p.y}px;width:${p.w}px;height:${p.h}px;z-index:${p.z}`;
      const img = document.createElement("img");
      const want = p.w * (window.devicePixelRatio || 1); // pixels this piece needs across
      img.src = variant(p.item, want > 1500 ? 2400 : want > 800 ? 1440 : 900);
      img.srcset = srcset(p.item);
      img.sizes = `${Math.round(p.w)}px`;
      img.width = p.item[1];
      img.height = p.item[2];
      img.alt = p.item[3] || "Photograph";
      img.decoding = "async";
      img.loading = eager ? "eager" : "lazy";
      fig.appendChild(img);
      scene.el.appendChild(fig);
      p.el = fig;
      place3d(p, scene);
      landing.observe(fig);
    }
  }
  function unmount(scene: Scene) {
    if (!scene.mounted) return;
    scene.mounted = false;
    for (const p of scene.pieces) if (p.el) landing.unobserve(p.el);
    scene.el.replaceChildren();
  }

  /** Where a piece sits right now: its layout spot plus a drift that grows with its distance from the screen's middle. */
  function place3d(p: Piece, scene: Scene) {
    if (!p.el) return;
    const { H } = viewport();
    const centre = window.scrollY + H / 2 - (scene.top + p.y + p.h / 2);
    p.el.style.transform = `translate3d(0, ${(centre * p.speed).toFixed(1)}px, 0) rotate(${p.rot}deg)`;
  }

  // ---- the combo counter: one more for every photograph that lands; it fades when you stop, the count stays ----------------
  let combos = 0;
  let comboTimer = 0;
  function bumpCombo() {
    comboN.textContent = String(++combos);
    combo.classList.add("on");
    if (!reduced) {
      comboN.animate(
        [
          { transform: "scale(1.75) skewX(-8deg)", filter: "brightness(2.2)" },
          { transform: "scale(1) skewX(-8deg)", filter: "brightness(1)" },
        ],
        { duration: 260, easing: "cubic-bezier(0.2, 0.9, 0.25, 1)" },
      );
    }
    clearTimeout(comboTimer);
    comboTimer = window.setTimeout(() => combo.classList.remove("on"), 2600);
  }
  cleanups.push(() => clearTimeout(comboTimer));

  // ---- the hit ---------------------------------------------------------------------------------------------------------------
  let lastHit = 0;
  function land(el: HTMLElement) {
    const delay = Math.max(0, lastHit + 150 - performance.now()); // several arriving together fire in turn
    lastHit = performance.now() + delay;
    window.setTimeout(() => {
      el.classList.add("landed");
      bumpCombo();
      playHit(); // in the same instant as the flash
      if (reduced) return;
      const r = el.getBoundingClientRect();
      const x = clamp(r.left + r.width * rand(0.3, 0.7), 40, window.innerWidth - 40);
      const y = clamp(r.top + r.height * rand(0.3, 0.65), 40, window.innerHeight - 40);
      hits.burst(x, y, clamp(r.width / (window.innerWidth * 0.4), 0.7, 1.35));
      stage.animate(
        [{ transform: "translate(0,0)" }, { transform: `translate(${rand(-5, 5)}px, ${rand(-4, 4)}px)` }, { transform: `translate(${rand(-3, 3)}px, ${rand(-2, 2)}px)` }, { transform: "translate(0,0)" }],
        { duration: 170, easing: "ease-out" },
      );
    }, delay);
  }

  // ---- scrolling -------------------------------------------------------------------------------------------------------------
  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const { H } = viewport();
      const y = window.scrollY;
      while (nextTop < y + H * 3.5) addScene(); // always a few screens ahead
      for (const s of scenes) {
        const near = s.top + s.h > y - H * 2 && s.top < y + H * 3;
        if (near) {
          mount(s);
          if (!reduced) for (const p of s.pieces) place3d(p, s);
        } else unmount(s);
      }
    });
  }
  listen("scroll", onScroll, { passive: true });
  listen("resize", onScroll);

  // ---- hit sounds: six clips, one fired with each flash, only while the sound is on ----------------------------------------
  const HIT_URLS = [1, 2, 3, 4, 5, 6].map((n) => `/m/azure/hit-${n}.wav`);
  let sfx: AudioContext | null = null;
  const hitBuffers: AudioBuffer[] = [];
  let lastHitSound = -1;
  const voices: AudioBufferSourceNode[] = [];
  /** Must be called from a click: creates the audio context and decodes the clips once. */
  function prepareSfx() {
    if (sfx) {
      void sfx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = (sfx = new AC());
    void ctx.resume();
    HIT_URLS.forEach(async (url, i) => {
      try {
        hitBuffers[i] = await ctx.decodeAudioData(await (await fetch(url)).arrayBuffer());
      } catch {
        /* a missing clip just means that one never plays */
      }
    });
  }
  function playHit() {
    // "sound on" = the music is playing: mute (or entering without sound) silences these too
    if (!sfx || !wantSound || audio.paused || document.hidden) return;
    const ready = hitBuffers.map((b, i) => (b ? i : -1)).filter((i) => i >= 0 && i !== lastHitSound);
    if (!ready.length) return;
    const i = ready[Math.floor(Math.random() * ready.length)];
    lastHitSound = i;
    const src = sfx.createBufferSource();
    src.buffer = hitBuffers[i];
    src.playbackRate.value = rand(0.96, 1.05); // a touch of variety so repeats do not sound identical
    const gain = sfx.createGain();
    gain.gain.value = 0.9;
    src.connect(gain).connect(sfx.destination);
    voices.push(src);
    if (voices.length > 4) voices.shift()?.stop(); // never a wall of overlapping hits
    src.onended = () => {
      const k = voices.indexOf(src);
      if (k >= 0) voices.splice(k, 1);
    };
    src.start();
  }
  cleanups.push(() => {
    voices.forEach((v) => v.stop());
    void sfx?.close();
  });

  // ---- music, enter ----------------------------------------------------------------------------------------------------------
  let wantSound = false;
  const setSoundUi = () => {
    const on = wantSound && !audio.paused;
    soundBtn.setAttribute("aria-pressed", String(on));
    soundBtn.setAttribute("aria-label", on ? "Sound on, tap to mute" : "Sound off, tap to play");
    soundBtn.dataset.on = on ? "1" : "0";
  };
  function fadeIn() {
    audio.volume = 0;
    const t0 = performance.now();
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / 1800);
      audio.volume = 0.72 * k;
      if (k < 1 && !audio.paused) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  async function playMusic() {
    wantSound = true;
    prepareSfx();
    const started = audio.play(); // `paused` flips at once; the promise settles when the track has buffered
    setSoundUi();
    try {
      await started;
      fadeIn();
    } catch {
      wantSound = false;
    }
    setSoundUi();
  }
  soundBtn.addEventListener("click", () => {
    if (!audio.paused) {
      audio.pause();
      wantSound = false;
      setSoundUi();
    } else void playMusic();
  });
  const onVisibility = () => {
    if (document.hidden) audio.pause();
    else if (wantSound) void audio.play().then(setSoundUi, setSoundUi);
  };
  document.addEventListener("visibilitychange", onVisibility);
  cleanups.push(() => document.removeEventListener("visibilitychange", onVisibility));

  function start(withSound: boolean) {
    document.documentElement.classList.remove("az-locked");
    intro.classList.add("out");
    window.setTimeout(() => (intro.hidden = true), 700);
    window.scrollTo(0, 0);
    for (let i = 0; i < 3; i++) addScene();
    onScroll();
    soundBtn.hidden = false;
    if (withSound) void playMusic();
    else setSoundUi();
  }
  document.documentElement.classList.add("az-locked");
  const enter = document.getElementById("az-enter") as HTMLButtonElement;
  const silent = document.getElementById("az-silent") as HTMLButtonElement;
  enter.addEventListener("click", () => start(true), { once: true });
  silent.addEventListener("click", () => start(false), { once: true });
  enter.focus({ preventScroll: true });

  return () => {
    cleanups.forEach((f) => f());
    landing.disconnect();
    hits.destroy();
    audio.pause();
    document.documentElement.classList.remove("az-locked");
  };
}
