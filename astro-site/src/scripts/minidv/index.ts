// /mini-dv: a walk through a scan of my desk, then the tapes. Scrolling flies the camera along the walk (captions come and go, the way
// they do in the New York Times' Jackson Heights tour). Choosing a tape by name, or pulling the drawer and picking one, takes the
// camera over: the drawer slides open, the cassette comes out of its case, goes to the Sony deck and in, and the camera flies up to
// the deck's screen, which plays the tape. "Back to desk" hands the camera back to the scroll.
import { TAPES } from "../../lib/minidv";
import { DeckScreen } from "./deck";
import { DeskWorld } from "./world";
import { sfx } from "./sfx";

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const clock = (s: number) => {
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600);
  return `${h ? `${h}:` : ""}${String(Math.floor((s % 3600) / 60)).padStart(h ? 2 : 1, "0")}:${String(s % 60).padStart(2, "0")}`;
};

export function initMiniDv(): () => void {
  const q = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel);
  const stage = q("#md-stage");
  const hud = q("#md-hud");
  const lcd = document.createElement("canvas");
  if (!stage || !hud) return () => {};

  const ac = new AbortController();
  const opts = { signal: ac.signal };
  const root = document.documentElement;
  const status = q("#md-status")!;
  const tip = q("#md-tip")!;
  const hint = q("#md-hint")!;
  const list = q("#md-list")!;
  const now = q("#md-now")!;
  const seek = q<HTMLInputElement>("#md-seek")!;
  const timeLabel = q("#md-time")!;
  const screenBox = q("#md-screen")!;
  const playBtn = q<HTMLButtonElement>("[data-act='play']")!;
  const shelf = q("#md-shelf")!;
  const cue = q("#md-cue");
  const caps = Array.from(document.querySelectorAll<HTMLElement>(".md-cap"));
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const deck = new DeckScreen(lcd);
  let world: DeskWorld | null = null;
  let busy = false;
  let queued: string | null = null;
  let hudOpen = false;
  let returnFocus: HTMLElement | null = null;
  let progress = 0;

  const say = (text: string) => {
    status.textContent = text;
  };
  const buttons = () => Array.from(list.querySelectorAll<HTMLButtonElement>("button[data-tape]"));
  const mark = (id: string | null) =>
    buttons().forEach((b) => {
      if (b.dataset.tape === id) b.setAttribute("aria-current", "true");
      else b.removeAttribute("aria-current");
    });
  const setBusy = (v: boolean) => {
    busy = v;
    if (world) world.busy = v;
    list.toggleAttribute("data-busy", v);
  };
  const setShelf = (open: boolean) => {
    q("#md-shelf-toggle")?.setAttribute("aria-expanded", String(open));
    shelf.classList.toggle("collapsed", !open);
  };
  /** while the camera is directed the page does not scroll (and the captions step aside) */
  const lockScroll = (on: boolean) => root.classList.toggle("md-locked", on);

  // --- the walk ---------------------------------------------------------------------------------------------------------------
  function onScroll() {
    if (root.classList.contains("md-locked")) return;
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    progress = Math.min(1, Math.max(0, scrollY / max));
    world?.setProgress(progress);
    const step = 1 / Math.max(1, caps.length - 1);
    caps.forEach((c, i) => {
      const d = Math.abs(progress - i * step);
      const o = Math.min(1, Math.max(0, 1 - (d - 0.025) / (step * 0.42)));
      c.style.opacity = String(o);
      c.style.transform = `translateY(${(1 - o) * 14}px)`;
      c.toggleAttribute("data-on", o > 0.5);
    });
    if (cue) cue.toggleAttribute("hidden", progress > 0.02);
  }

  // --- the controls bar -------------------------------------------------------------------------------------------------------
  async function openHud() {
    if (hudOpen) return;
    hudOpen = true;
    returnFocus = document.activeElement as HTMLElement | null;
    now.textContent = deck.tape?.title ?? "";
    hud!.hidden = false;
    root.classList.add("md-watching");
    await new Promise((r) => requestAnimationFrame(r));
    hud!.classList.add("open");
    playBtn.focus({ preventScroll: true });
  }

  function closeHud(focus = true) {
    if (!hudOpen) return;
    hudOpen = false;
    if (document.fullscreenElement) void document.exitFullscreen();
    hud!.classList.remove("open");
    root.classList.remove("md-watching");
    setTimeout(() => {
      if (!hudOpen) hud!.hidden = true;
    }, 320);
    if (focus) returnFocus?.focus({ preventScroll: true });
  }

  /** hand the camera back to the scroll */
  async function backToDesk() {
    if (busy) return;
    closeHud();
    if (!world) return lockScroll(false);
    setBusy(true);
    try {
      await world.cam("tour", 1.3);
    } finally {
      lockScroll(false);
      setBusy(false);
      onScroll();
    }
  }

  // --- the sequences ----------------------------------------------------------------------------------------------------------
  /** take the cassette out of the deck and put it back in its case */
  async function unload() {
    const tape = deck.tape;
    if (!tape) return;
    closeHud(false);
    deck.eject();
    mark(null);
    if (!world) return;
    void world.setLcd(false);
    await Promise.all([world.cam("carry", 1.0), world.slideOut(tape.id), world.openDrawer()]);
    await world.putBack(tape.id);
  }

  async function choose(id: string) {
    const tape = TAPES.find((t) => t.id === id);
    if (!tape) return;
    if (busy) {
      queued = id;
      say("One moment…");
      return;
    }
    if (deck.tape?.id === id) {
      void watch();
      return;
    }
    setBusy(true);
    lockScroll(true);
    hint.hidden = true;
    sfx.unlock();
    setShelf(false);
    try {
      deck.prime(tape); // inside the click: starts the download and lets sound through later
      say(`Loading ${tape.title}`);
      closeHud(false);
      if (deck.tape) await unload();
      if (world) {
        await world.openDrawer();
        await world.carryToDeck(id);
        await world.insert(id);
        deck.insert(tape);
        mark(id);
        sfx.whirr(1.5);
        void world.setLcd(true);
        void world.closeDrawer();
        await Promise.all([world.cam("watch", 1.5), wait(reduce ? 400 : 1300)]);
      } else {
        deck.insert(tape);
        mark(id);
        await wait(900);
      }
      await openHud();
      await wait(reduce ? 200 : 500);
      await deck.start();
      say(`Playing ${tape.title}`);
    } catch (err) {
      console.error(err);
      say("The desk got stuck. Try the tape again.");
      lockScroll(false);
    } finally {
      setBusy(false);
      if (queued) {
        const next = queued;
        queued = null;
        void choose(next);
      }
    }
  }

  async function watch() {
    if (busy || !deck.tape) return;
    setBusy(true);
    lockScroll(true);
    try {
      await world?.cam("watch", 1.2);
      await openHud();
    } finally {
      setBusy(false);
    }
  }

  async function eject() {
    if (busy || !deck.tape) return;
    setBusy(true);
    lockScroll(true);
    try {
      const title = deck.tape.title;
      sfx.beep();
      say(`Ejecting ${title}`);
      await unload();
      if (world) {
        await wait(500);
        await world.closeDrawer();
        await world.cam("tour", 1.3);
      }
      lockScroll(false);
      say(`${title} is back in the drawer`);
    } finally {
      setBusy(false);
      onScroll();
      if (queued) {
        const next = queued;
        queued = null;
        void choose(next);
      }
    }
  }

  async function toggleDrawer() {
    if (busy || !world) return;
    hint.hidden = true;
    sfx.unlock();
    setBusy(true);
    lockScroll(true);
    try {
      if (world.drawerOpen) {
        await world.closeDrawer();
        await world.cam("tour", 1.1);
        lockScroll(false);
        say("Drawer closed");
      } else {
        await world.openDrawer();
        say("Drawer open. Choose a tape.");
      }
    } finally {
      setBusy(false);
      onScroll();
    }
  }

  // --- wiring -----------------------------------------------------------------------------------------------------------------
  try {
    world = new DeskWorld(stage, deck, {
      onPickTape: (id) => void choose(id),
      onDrawer: () => void toggleDrawer(),
      onDeck: () => {
        if (deck.tape) void watch();
        else if (!busy) say("The deck is empty. Choose a tape.");
      },
      onHover: (h) => {
        if (!h) {
          tip.hidden = true;
          buttons().forEach((b) => b.classList.remove("hover"));
          return;
        }
        tip.textContent = h.label;
        tip.style.transform = `translate(${Math.round(h.x + 14)}px, ${Math.round(h.y + 16)}px)`;
        tip.hidden = false;
        buttons().forEach((b) => b.classList.toggle("hover", b.dataset.tape === h.tapeId));
      },
    });
    if (reduce) world.speed = 4;
    world.ready.catch(() => stage.classList.add("no-webgl"));
  } catch {
    world = null;
    stage.classList.add("no-webgl"); // no WebGL: the photograph alone, and the tapes still play
    screenBox.appendChild(lcd);
    screenBox.hidden = false;
  }

  list.addEventListener(
    "click",
    (e) => {
      const b = (e.target as Element).closest<HTMLButtonElement>("button[data-tape]");
      if (b?.dataset.tape) void choose(b.dataset.tape);
    },
    opts,
  );
  const lift = (e: Event) => world?.highlight((e.target as Element).closest<HTMLButtonElement>("button[data-tape]")?.dataset.tape ?? null);
  list.addEventListener("pointerover", lift, opts);
  list.addEventListener("focusin", lift, opts);
  list.addEventListener("pointerleave", () => world?.highlight(null), opts);
  list.addEventListener("focusout", () => world?.highlight(null), opts);

  // the deck's buttons, on the controls bar
  let hold = 0;
  let held = false;
  hud.addEventListener(
    "pointerdown",
    (e) => {
      const b = (e.target as Element).closest<HTMLButtonElement>("[data-act='rew'],[data-act='ff']");
      if (!b) return;
      held = false;
      const dir = b.dataset.act === "rew" ? -1 : 1;
      hold = window.setTimeout(() => {
        held = true;
        deck.search(dir);
      }, 280);
    },
    opts,
  );
  const release = () => {
    window.clearTimeout(hold);
    if (held) deck.endSearch();
  };
  hud.addEventListener("pointerup", release, opts);
  hud.addEventListener("pointercancel", release, opts);
  const toggleFull = () => void (document.fullscreenElement ? document.exitFullscreen() : screenBox.requestFullscreen?.());
  const enterTheatre = () => {
    // the deck's picture, big: the same canvas, moved into a box that can go full screen
    if (!screenBox.contains(lcd)) screenBox.appendChild(lcd);
    screenBox.hidden = false;
    toggleFull();
  };
  document.addEventListener(
    "fullscreenchange",
    () => {
      if (!document.fullscreenElement && world && screenBox.contains(lcd)) {
        lcd.remove();
        screenBox.hidden = true;
      }
    },
    opts,
  );
  hud.addEventListener(
    "click",
    (e) => {
      const t = e.target as Element;
      if (t.closest("[data-hud-close]")) return void backToDesk();
      if (t.closest("#md-full")) return enterTheatre();
      const b = t.closest<HTMLButtonElement>("[data-act]");
      if (!b?.dataset.act) return;
      const act = b.dataset.act;
      if (act === "rew" || act === "ff") {
        if (held) return void (held = false); // a hold already searched
        sfx.beep();
        deck.skip(act === "rew" ? -10 : 10);
        return;
      }
      sfx.beep();
      if (act === "play") deck.toggle();
      else if (act === "stop") deck.stop();
      else if (act === "eject") void eject();
      else if (act === "vol-up") deck.volume(0.1);
      else if (act === "vol-down") deck.volume(-0.1);
    },
    opts,
  );
  seek.addEventListener(
    "input",
    () => {
      if (deck.tape) deck.video.currentTime = (Number(seek.value) / 1000) * deck.duration;
    },
    opts,
  );
  if (!document.fullscreenEnabled) q("#md-full")?.setAttribute("hidden", "");

  q("#md-shelf-toggle")?.addEventListener("click", (e) => setShelf((e.currentTarget as HTMLElement).getAttribute("aria-expanded") !== "true"), opts);
  const sound = q<HTMLButtonElement>("#md-sound");
  sound?.addEventListener(
    "click",
    () => {
      sfx.setMuted(!sfx.muted);
      sound.setAttribute("aria-pressed", String(!sfx.muted));
      sound.setAttribute("aria-label", sfx.muted ? "Desk sounds off, tap to turn on" : "Desk sounds on, tap to turn off");
    },
    opts,
  );

  document.addEventListener(
    "keydown",
    (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement).tagName;
      if (e.key === "Escape" && hudOpen && !document.fullscreenElement) return void backToDesk();
      if (!hudOpen || tag === "INPUT") return;
      if (e.key === " " && tag !== "BUTTON") {
        e.preventDefault();
        deck.toggle();
      } else if (e.key === "ArrowLeft") deck.skip(-10);
      else if (e.key === "ArrowRight") deck.skip(10);
      else if (e.key === "f" || e.key === "F") enterTheatre();
    },
    opts,
  );

  deck.onChange = () => {
    hud.setAttribute("data-state", deck.state);
    playBtn.setAttribute("aria-label", deck.state === "playing" ? "Pause" : "Play");
    if (deck.state === "playing" && deck.tape) say(`Playing ${deck.tape.title}`);
    else if (deck.state === "paused") say("Paused");
    else if (deck.state === "stopped" && deck.tape) say("Stopped");
  };

  window.addEventListener("scroll", onScroll, { ...opts, passive: true });
  window.addEventListener("resize", onScroll, opts);

  // --- the loop ---------------------------------------------------------------------------------------------------------------
  let raf = 0;
  let last = performance.now();
  let lastUi = 0;
  const loop = (t: number) => {
    raf = requestAnimationFrame(loop);
    const dt = (t - last) / 1000;
    last = t;
    deck.draw(t);
    world?.render(dt);
    // the hint: once the walk reaches the drawer, until it has been pulled
    const showHint = !!world && progress > 0.86 && !busy && !world.drawerOpen && !deck.tape && !root.classList.contains("md-locked");
    if (showHint && world) {
      const p = world.hintPosition();
      hint.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) translate(-50%, 0)`;
    }
    hint.hidden = !showHint;
    if (hudOpen && t - lastUi > 250 && deck.tape) {
      lastUi = t;
      const dur = deck.duration;
      if (document.activeElement !== seek) seek.value = dur ? String(Math.round((deck.currentTime / dur) * 1000)) : "0";
      timeLabel.textContent = `${clock(deck.currentTime)} / ${clock(dur)}`;
    }
  };
  raf = requestAnimationFrame(loop);

  setShelf(false);
  onScroll();
  say(world ? "Scroll to walk along the desk." : "Choose a tape from the list.");
  if (import.meta.env.DEV) Object.assign(window, { __md: { world, deck, choose, eject } }); // for poking at it from the console

  return () => {
    cancelAnimationFrame(raf);
    ac.abort();
    window.clearTimeout(hold);
    if (document.fullscreenElement) void document.exitFullscreen();
    root.classList.remove("md-locked", "md-watching");
    deck.eject();
    deck.video.remove();
    world?.dispose();
  };
}
