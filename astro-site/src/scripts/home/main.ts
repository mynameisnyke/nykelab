// Home page controller: wires the list, lens tabs, the three views and the preview card
// to one shared store.
import {
  fmtDate,
  fmtHour,
  fmtN,
  goldenShare,
  summarize,
  topSetting,
  unpackHome,
  type PackedHome,
} from "../../lib/voyages";
import { createStore, type Lens } from "./store";
// three.js (globe) and d3 (When / How) are the bulk of the page's script, so they load on demand:
// the list, preview and stats paint first.

export function initHome(): () => void {
  const root = document.querySelector<HTMLElement>("main.home")!;
  const data = unpackHome(JSON.parse(document.getElementById("home-data")!.textContent!) as PackedHome);
  const { voyages, shots, images } = data;
  const store = createStore(data);
  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

  const canvas = $<HTMLCanvasElement>("globe");
  const chart = $("chart");
  const insight = $("insight");
  const reset = $("reset");
  const previewImg = $<HTMLImageElement>("preview-img");
  const previewTitle = $("preview-title");
  const previewMeta = $("preview-meta");
  const previewOpen = $<HTMLAnchorElement>("preview-open");
  const items = [...root.querySelectorAll<HTMLElement>("#voyage-list li")];
  const tabs = [...root.querySelectorAll<HTMLButtonElement>("[data-lens-btn]")];
  const cleanups: (() => void)[] = [];
  const on = <K extends keyof HTMLElementEventMap>(el: HTMLElement, type: K, fn: (e: HTMLElementEventMap[K]) => void) => {
    el.addEventListener(type, fn as EventListener);
    cleanups.push(() => el.removeEventListener(type, fn as EventListener));
  };

  // ---- views ------------------------------------------------------------------
  let destroyed = false;
  let globe: { destroy(): void } | null = null;
  let view: { destroy(): void } | null = null;
  let seq = 0; // guards async view loads against quick tab switching

  const hasWebGL = () => {
    try {
      const probe = document.createElement("canvas");
      return !!(probe.getContext("webgl2") || probe.getContext("webgl"));
    } catch {
      return false;
    }
  };
  const webgl = hasWebGL();
  const dropGlobe = (err?: unknown) => {
    // No WebGL: the 2D views still work.
    if (err) console.warn("WebGL unavailable; showing 2D views only", err);
    canvas.hidden = true;
    tabs.find((t) => t.dataset.lensBtn === "where")!.hidden = true;
  };
  if (!webgl) dropGlobe();

  function setLens(lens: Lens) {
    store.set({ lens });
    root.dataset.lens = lens;
    tabs.forEach((t) => t.setAttribute("aria-selected", String(t.dataset.lensBtn === lens)));
    view?.destroy();
    view = null;
    chart.replaceChildren();
    chart.hidden = lens === "where";
    const mine = ++seq;
    if (lens === "when") void import("./when").then((m) => mine === seq && !destroyed && ((view = m.createWhen(chart, store)), render()));
    if (lens === "how") void import("./how").then((m) => mine === seq && !destroyed && ((view = m.createHow(chart, store)), render()));
    render();
  }
  tabs.forEach((t) =>
    on(t, "click", () => {
      setLens(t.dataset.lensBtn as Lens);
      history.replaceState(null, "", `#${t.dataset.lensBtn}`);
    }),
  );
  tabs.forEach((t) =>
    on(t, "keydown", (e) => {
      const visible = tabs.filter((b) => !b.hidden);
      const at = visible.indexOf(t);
      const next = e.key === "ArrowRight" ? visible[(at + 1) % visible.length] : e.key === "ArrowLeft" ? visible[(at - 1 + visible.length) % visible.length] : null;
      if (next) {
        e.preventDefault();
        next.focus();
        setLens(next.dataset.lensBtn as Lens);
      }
    }),
  );

  // ---- list <-> store -----------------------------------------------------------
  items.forEach((li) => {
    const i = Number(li.dataset.v);
    on(li, "mouseenter", () => store.set({ hoverV: i, hoverShot: null }));
    on(li, "mouseleave", () => store.set({ hoverV: null }));
    on(li, "focusin", () => store.set({ hoverV: i, hoverShot: null }));
    on(li, "focusout", () => store.set({ hoverV: null }));
  });
  on(reset, "click", () => store.set({ range: null, gear: null }));

  // ---- numbers that depend only on the filter, not on hover ---------------------------
  // render() runs on every pointer move; with thousands of photographs, re-scanning them each time is too slow.
  let derivedKey = "";
  let derived: { vis: typeof shots; counts: number[]; s: ReturnType<typeof summarize>; golden?: number; top?: ReturnType<typeof topSetting> } = {
    vis: shots,
    counts: [],
    s: summarize(voyages, shots),
  };
  function filtered() {
    const { range, gear } = store.state;
    const key = `${range ? range.join() : ""}|${gear ? `${gear.focal}/${gear.f}` : ""}`;
    if (key !== derivedKey) {
      derivedKey = key;
      const vis = store.visibleShots();
      const counts: number[] = new Array(voyages.length).fill(0);
      for (const sh of vis) counts[sh.v]++;
      derived = { vis, counts, s: vis.length ? summarize(voyages.filter((_, i) => counts[i] > 0), vis) : summarize(voyages, shots) };
    }
    return derived;
  }

  // ---- preview card ----------------------------------------------------------------
  const newest = voyages.reduce((a, v, i) => (v.start > voyages[a].start ? i : a), 0);
  function showImage(i: number) {
    const img = images[i];
    if (!img) {
      // No published photograph for this voyage: show nothing rather than another voyage's.
      previewImg.removeAttribute("src");
      previewImg.removeAttribute("srcset");
      previewImg.alt = "";
      previewImg.style.opacity = "0";
      return;
    }
    if (previewImg.getAttribute("src") === img.src) return;
    previewImg.style.opacity = "0";
    previewImg.onload = () => (previewImg.style.opacity = "1");
    previewImg.alt = img.alt;
    previewImg.sizes = "440px";
    if (img.srcset) previewImg.srcset = img.srcset;
    else previewImg.removeAttribute("srcset");
    previewImg.src = img.src;
  }
  const span = (v: (typeof voyages)[number]) => (v.end > v.start ? `${fmtDate(v.start)} – ${fmtDate(v.end)}` : fmtDate(v.start));

  function renderPreview() {
    const { hoverShot } = store.state;
    const av = store.activeV();
    let vi: number;
    if (hoverShot !== null) {
      const s = shots[hoverShot];
      vi = s.v;
      showImage(s.img);
      previewTitle.textContent = voyages[vi].title;
      previewMeta.textContent = `${voyages[vi].place} · ${fmtDate(s.t)}, ${fmtHour(s.clock)} · ${s.focal}mm f/${s.f} · ISO ${s.iso} · ${s.shutter}`;
    } else {
      vi = av ?? newest;
      const v = voyages[vi];
      const n = filtered().counts[vi];
      showImage(v.cover);
      previewTitle.textContent = v.title;
      previewMeta.textContent = `${v.place} · ${span(v)} · ${fmtN(n)} photograph${n === 1 ? "" : "s"}`;
    }
    const v = voyages[vi];
    previewOpen.hidden = !v.available;
    if (v.available) {
      previewOpen.href = `/${v.collection}`;
      previewOpen.textContent = `Open ${v.title} →`;
    }
  }

  // ---- insight line ------------------------------------------------------------------
  function renderInsight() {
    const d = filtered();
    const vis = d.vis;
    const { lens } = store.state;
    const av = store.activeV();
    if (!vis.length) {
      insight.textContent = "No photographs match this filter.";
    } else if (lens === "when") {
      const pct = Math.round((d.golden ??= goldenShare(vis)) * 100);
      insight.innerHTML = `<b>${pct}%</b> of ${vis.length === shots.length ? "these photographs" : `these ${fmtN(vis.length)} photographs`} were made within an hour of sunrise or sunset.`;
    } else if (lens === "how") {
      const t = (d.top ??= topSetting(vis))!;
      insight.innerHTML = `Most often <b>${t.focal}mm</b> at <b>f/${t.f}</b>, ${Math.round(t.share * 100)}% of ${vis.length === shots.length ? "everything" : `these ${vis.length}`}.`;
    } else if (av !== null) {
      insight.textContent = voyages[av].place;
    } else {
      insight.textContent = matchMedia("(hover: none)").matches ? "Tap a gallery. Drag to turn the globe." : "Hover a gallery. Drag to turn the globe.";
    }
  }

  // ---- everything that follows the store -----------------------------------------------
  function render() {
    const av = store.activeV();
    root.toggleAttribute("data-dim", av !== null);
    const d = filtered();
    items.forEach((li) => {
      const i = Number(li.dataset.v);
      const n = d.counts[i];
      li.classList.toggle("hot", i === av);
      li.classList.toggle("dead", n === 0);
      const el = li.querySelector(".n");
      if (el) el.textContent = String(n);
    });
    reset.hidden = !(store.state.range || store.state.gear);
    const vis = d.vis;
    const stats = $("stats");
    const s = d.s;
    const line = (t: string) => `<span>${t}</span>`;
    const countries = `${s.countries} ${s.countries === 1 ? "country" : "countries"}`;
    stats.innerHTML =
      vis.length === shots.length
        ? line(`${fmtN(s.photos)} photographs · ${s.voyages} galleries`) + line(`${countries} · ${s.from}–${s.to}`)
        : line(`${fmtN(vis.length)} of ${fmtN(shots.length)} photographs`) + line(`${countries} · ${s.from}–${s.to}`);
    renderPreview();
    renderInsight();
  }
  const unsub = store.subscribe(render);

  // Tap the empty globe to clear a pinned voyage on touch devices.
  // Deep-linkable: /#when, /#how. Falls back to the 2D views when WebGL is missing.
  const fromHash = location.hash.slice(1) as Lens;
  const start: Lens = fromHash === "when" || fromHash === "how" ? fromHash : webgl ? "where" : "when";
  setLens(start);
  if (webgl) {
    void import("./globe").then(({ createGlobe }) => {
      if (destroyed) return;
      try {
        globe = createGlobe(canvas, store);
      } catch (err) {
        dropGlobe(err);
        if (store.state.lens === "where") setLens("when");
      }
    });
  }
  // Following or typing /#when while already on the home page changes only the hash.
  const onHash = () => {
    const h = location.hash.slice(1) as Lens;
    if ((h === "when" || h === "how" || (h === "where" && webgl)) && h !== store.state.lens) setLens(h);
  };
  window.addEventListener("hashchange", onHash);
  cleanups.push(() => window.removeEventListener("hashchange", onHash));

  return () => {
    destroyed = true;
    unsub();
    cleanups.forEach((f) => f());
    view?.destroy();
    globe?.destroy();
  };
}
