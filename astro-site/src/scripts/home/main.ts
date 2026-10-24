// Home page controller: wires the list, lens tabs, the three views and the preview card
// to one shared store.
import {
  fmtDate,
  fmtHour,
  goldenShare,
  summarize,
  topSetting,
  type HomeData,
} from "../../lib/voyages";
import { createStore, type Lens } from "./store";
import { createGlobe } from "./globe";
import { createWhen } from "./when";
import { createHow } from "./how";

export function initHome(): () => void {
  const root = document.querySelector<HTMLElement>("main.home")!;
  const data = JSON.parse(document.getElementById("home-data")!.textContent!) as HomeData;
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
  let globe: { destroy(): void } | null = null;
  try {
    globe = createGlobe(canvas, store);
  } catch (err) {
    // No WebGL: the 2D views still work.
    console.warn("WebGL unavailable; showing 2D views only", err);
    canvas.hidden = true;
    tabs.find((t) => t.dataset.lensBtn === "where")!.hidden = true;
  }
  let view: { destroy(): void } | null = null;

  function setLens(lens: Lens) {
    store.set({ lens });
    root.dataset.lens = lens;
    tabs.forEach((t) => t.setAttribute("aria-selected", String(t.dataset.lensBtn === lens)));
    view?.destroy();
    view = null;
    chart.replaceChildren();
    chart.hidden = lens === "where";
    if (lens === "when") view = createWhen(chart, store);
    if (lens === "how") view = createHow(chart, store);
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

  // ---- preview card ----------------------------------------------------------------
  const newest = voyages.reduce((a, v, i) => (v.start > voyages[a].start ? i : a), 0);
  function showImage(i: number) {
    const img = images[i];
    if (!img) return;
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
      previewMeta.textContent = `${voyages[vi].place} · ${fmtDate(s.t)}, ${fmtHour(s.hour)} · ${s.focal}mm f/${s.f} · ISO ${s.iso} · ${s.shutter}`;
    } else {
      vi = av ?? newest;
      const v = voyages[vi];
      const n = shots.filter((s) => s.v === vi && store.visible(s)).length;
      showImage(v.cover);
      previewTitle.textContent = v.title;
      previewMeta.textContent = `${v.place} · ${span(v)} · ${n} photograph${n === 1 ? "" : "s"}`;
    }
    const v = voyages[vi];
    previewOpen.hidden = !v.available;
    if (v.available) {
      previewOpen.href = `/${v.slug}`;
      previewOpen.textContent = `Open ${v.title} →`;
    }
  }

  // ---- insight line ------------------------------------------------------------------
  function renderInsight() {
    const vis = store.visibleShots();
    const { lens } = store.state;
    const av = store.activeV();
    if (!vis.length) {
      insight.textContent = "No photographs match this filter.";
    } else if (lens === "when") {
      const pct = Math.round(goldenShare(vis) * 100);
      insight.innerHTML = `<b>${pct}%</b> of ${vis.length === shots.length ? "these photographs" : `these ${vis.length} photographs`} were made within an hour of sunrise or sunset.`;
    } else if (lens === "how") {
      const t = topSetting(vis)!;
      insight.innerHTML = `Most often <b>${t.focal}mm</b> at <b>f/${t.f}</b>, ${Math.round(t.share * 100)}% of ${vis.length === shots.length ? "everything" : `these ${vis.length}`}.`;
    } else if (av !== null) {
      insight.textContent = voyages[av].place;
    } else {
      insight.textContent = "Hover a voyage. Drag to turn the globe.";
    }
  }

  // ---- everything that follows the store -----------------------------------------------
  function render() {
    const av = store.activeV();
    root.toggleAttribute("data-dim", av !== null);
    items.forEach((li) => {
      const i = Number(li.dataset.v);
      const n = shots.filter((s) => s.v === i && store.visible(s)).length;
      li.classList.toggle("hot", i === av);
      li.classList.toggle("dead", n === 0);
      const el = li.querySelector(".n");
      if (el) el.textContent = String(n);
    });
    reset.hidden = !(store.state.range || store.state.gear);
    const vis = store.visibleShots();
    const stats = $("stats");
    const present = voyages.filter((_, i) => vis.some((x) => x.v === i));
    const s = vis.length ? summarize(present, vis) : summarize(voyages, shots);
    const line = (t: string) => `<span>${t}</span>`;
    const countries = `${s.countries} ${s.countries === 1 ? "country" : "countries"}`;
    stats.innerHTML =
      vis.length === shots.length
        ? line(`${s.photos} photographs · ${s.voyages} voyages`) + line(`${countries} · ${s.from}–${s.to}`)
        : line(`${vis.length} of ${shots.length} photographs`) + line(`${countries} · ${s.from}–${s.to}`);
    renderPreview();
    renderInsight();
  }
  const unsub = store.subscribe(render);

  // Tap the empty globe to clear a pinned voyage on touch devices.
  // Deep-linkable: /#when, /#how. Falls back to the 2D views when WebGL is missing.
  const fromHash = location.hash.slice(1) as Lens;
  const start: Lens = fromHash === "when" || fromHash === "how" || (fromHash === "where" && globe) ? fromHash : globe ? "where" : "when";
  setLens(start);

  return () => {
    unsub();
    cleanups.forEach((f) => f());
    view?.destroy();
    globe?.destroy();
  };
}
