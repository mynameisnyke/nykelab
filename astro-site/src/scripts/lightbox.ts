// Click-to-enlarge for the gallery photographs (markup and styles: components/Lightbox.astro).
//  - the photograph flies from its place on the page to the middle of the screen over a black backdrop, and back on close
//  - the file the page already has shows at once; the largest one in the srcset replaces it once decoded
//  - ← → or a swipe move through the page's photographs; Esc, ×, the backdrop or a swipe down close
//  - the address gets #<id> (through Astro's router, so Back is an intra-page move and not a page swap): Back closes it and a
//    shared link opens that photograph
//  - keyboard: the photographs become buttons, the dialog traps focus and gives it back on close

import { navigate } from "astro:transitions/client";

const OPEN_MS = 480;
const STEP_MS = 280;
const EASE = "cubic-bezier(0.2, 0.7, 0.2, 1)";
const FLAT = { transform: "none", clipPath: "inset(0px)" };

interface Item {
  img: HTMLImageElement;
  id: string;
  w: number;
  h: number;
  caption: string;
}
interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function initLightbox(): () => void {
  const root = document.getElementById("lightbox");
  if (!root) return () => {};
  const lb: HTMLElement = root;
  const items: Item[] = [...document.querySelectorAll<HTMLImageElement>("img[data-media]")]
    .filter((img) => !img.closest("a"))
    .map((img) => ({
      img,
      id: img.dataset.id ?? "",
      // the photograph's own size (the width/height attributes come from the database); img.width would be the rendered box
      w: Number(img.getAttribute("width")) || img.naturalWidth || 3,
      h: Number(img.getAttribute("height")) || img.naturalHeight || 2,
      caption: captionOf(img),
    }));
  if (!items.length) return () => {};
  const fig = lb.querySelector<HTMLElement>(".lb-fig")!;
  const image = lb.querySelector<HTMLImageElement>(".lb-img")!;
  const cap = lb.querySelector<HTMLElement>(".lb-cap")!;
  const count = lb.querySelector<HTMLElement>(".lb-count")!;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let cur = -1;
  let pushed = false; // we added the #id entry, so closing goes back
  let anim: Animation | null = null;
  let placed: Rect = { left: 0, top: 0, width: 0, height: 0 };

  items.forEach((it, i) => {
    it.img.dataset.lb = String(i);
    it.img.tabIndex = 0;
    it.img.setAttribute("role", "button");
    if (!it.img.alt) it.img.alt = "Photograph";
  });

  const place = (r: Rect) => {
    placed = r;
    fig.style.left = `${r.left}px`;
    fig.style.top = `${r.top}px`;
    fig.style.width = `${r.width}px`;
    fig.style.height = `${r.height}px`;
  };
  const preload = (i: number) => {
    const it = items[i];
    if (!it) return;
    const im = new Image();
    im.srcset = it.img.srcset;
    im.sizes = "100vw";
    im.src = it.img.src;
  };

  function show(i: number, from: DOMRect | null, dir: number) {
    const it = items[i];
    cur = i;
    anim?.cancel();
    fig.style.transform = "";
    fig.style.opacity = "";
    image.removeAttribute("srcset");
    image.removeAttribute("sizes");
    image.src = it.img.currentSrc || it.img.src;
    image.alt = it.img.alt;
    cap.textContent = it.caption;
    count.textContent = `${i + 1} / ${items.length}`;
    lb.classList.toggle("first", i === 0);
    lb.classList.toggle("last", i === items.length - 1);
    const to = fit(it.w, it.h);
    place(to);
    if (reduced) anim = null;
    else if (from) anim = fig.animate([flight(it, from, to), FLAT], { duration: OPEN_MS, easing: EASE });
    else if (dir) anim = fig.animate([{ transform: `translateX(${dir * 40}px)`, opacity: 0 }, { transform: "none", opacity: 1 }], { duration: STEP_MS, easing: EASE });
    // the largest file, swapped in once it has decoded
    const big = new Image();
    big.srcset = it.img.srcset;
    big.sizes = "100vw";
    big.src = it.img.src;
    big.decode().then(
      () => {
        if (cur !== i) return;
        image.srcset = it.img.srcset;
        image.sizes = "100vw";
      },
      () => {},
    );
    preload(i - 1);
    preload(i + 1);
  }

  function open(i: number, fromPage: boolean) {
    if (cur >= 0 || !items[i]) return;
    lb.hidden = false;
    lb.style.pointerEvents = "";
    void lb.offsetWidth; // so the backdrop transitions in
    lb.classList.add("open");
    show(i, fromPage ? items[i].img.getBoundingClientRect() : null, 0);
    lb.querySelector<HTMLElement>(".lb-close")?.focus();
  }

  function hide() {
    if (cur < 0) return;
    const it = items[cur];
    cur = -1;
    pushed = false;
    lb.classList.remove("open");
    anim?.cancel();
    fig.style.transform = "";
    fig.style.opacity = "";
    const r = it.img.getBoundingClientRect();
    const onPage = r.width > 0 && r.bottom > 0 && r.top < innerHeight;
    const done = () => {
      if (cur < 0) lb.hidden = true;
    };
    lb.style.pointerEvents = "none"; // the page is usable again while the picture flies back
    if (reduced) done();
    else {
      anim = onPage
        ? fig.animate([FLAT, flight(it, r, placed)], { duration: OPEN_MS, easing: EASE, fill: "forwards" })
        : fig.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: "forwards" });
      anim.finished.then(done, done);
      setTimeout(done, OPEN_MS + 100); // the finished promise can lag a busy frame
    }
    it.img.focus({ preventScroll: true });
  }

  function close() {
    if (cur < 0) return;
    if (pushed) history.back();
    else {
      history.replaceState(history.state, "", location.pathname + location.search);
      hide();
    }
  }

  function step(dir: number) {
    const n = cur + dir;
    if (cur < 0 || !items[n]) return;
    show(n, null, dir);
    history.replaceState(history.state, "", `#${items[n].id}`);
  }

  const onHash = () => {
    const id = decodeURIComponent(location.hash.slice(1));
    const i = id ? items.findIndex((it) => it.id === id) : -1;
    if (i >= 0) {
      if (cur < 0) {
        pushed = true;
        open(i, false);
      } else if (cur !== i) show(i, null, i > cur ? 1 : -1);
    } else if (cur >= 0) hide();
  };

  let dragged = false;
  const onClick = (e: MouseEvent) => {
    const t = e.target as Element;
    const img = t.closest<HTMLImageElement>("img[data-lb]");
    if (img) {
      e.preventDefault();
      const i = Number(img.dataset.lb);
      open(i, true);
      if (cur === i) {
        pushed = true;
        // Astro records scroll 0,0 on the entry it pushes; keep the real position so Forward does not jump to the top
        navigate(`#${items[i].id}`).then(() => history.replaceState({ ...history.state, scrollX, scrollY }, ""));
      }
      return;
    }
    if (cur < 0 || !lb.contains(t)) return;
    if (dragged) {
      dragged = false;
      return;
    }
    if (t.closest(".lb-close, .lb-backdrop")) close();
    else if (t.closest(".lb-prev")) step(-1);
    else if (t.closest(".lb-next")) step(1);
  };

  const focusables = () => [...lb.querySelectorAll<HTMLElement>("button")].filter((b) => b.offsetParent !== null);
  const onKey = (e: KeyboardEvent) => {
    const t = e.target as Element;
    if (cur < 0) {
      if ((e.key === "Enter" || e.key === " ") && t instanceof HTMLImageElement && t.dataset.lb) {
        e.preventDefault();
        t.click();
      }
      return;
    }
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        close();
        break;
      case "ArrowRight":
        e.preventDefault();
        step(1);
        break;
      case "ArrowLeft":
        e.preventDefault();
        step(-1);
        break;
      case "Tab": {
        const f = focusables();
        if (!f.length) break;
        const i = f.indexOf(document.activeElement as HTMLElement);
        const n = e.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : i < 0 || i === f.length - 1 ? 0 : i + 1;
        e.preventDefault();
        f[n].focus();
        break;
      }
      case " ":
      case "PageDown":
      case "PageUp":
      case "ArrowDown":
      case "ArrowUp":
      case "Home":
      case "End":
        e.preventDefault(); // the page under the dialog stays put
    }
  };

  // Drag the photograph: sideways for the next or previous one, down to close.
  let pid = -1;
  let px = 0;
  let py = 0;
  let dx = 0;
  let dy = 0;
  const onDown = (e: PointerEvent) => {
    if (cur < 0 || e.button !== 0 || !lb.contains(e.target as Node) || (e.target as Element).closest("button")) return;
    pid = e.pointerId;
    px = e.clientX;
    py = e.clientY;
    dx = dy = 0;
    dragged = false;
  };
  const onDrag = (e: PointerEvent) => {
    if (e.pointerId !== pid) return;
    dx = e.clientX - px;
    dy = e.clientY - py;
    if (!dragged && Math.hypot(dx, dy) > 8) dragged = true;
    if (!dragged) return;
    const vertical = Math.abs(dy) > Math.abs(dx);
    fig.style.transform = vertical ? `translateY(${dy}px)` : `translateX(${dx}px)`;
    fig.style.opacity = vertical ? String(Math.max(0.3, 1 - Math.abs(dy) / 400)) : "";
  };
  const onUp = (e: PointerEvent) => {
    if (e.pointerId !== pid) return;
    pid = -1;
    if (!dragged) return;
    const vertical = Math.abs(dy) > Math.abs(dx);
    fig.style.transform = "";
    fig.style.opacity = "";
    if (vertical && dy > 80) close();
    else if (!vertical && Math.abs(dx) > 60 && items[cur + (dx < 0 ? 1 : -1)]) step(dx < 0 ? 1 : -1);
    else if (!reduced) anim = fig.animate([{ transform: `translate(${vertical ? 0 : dx}px, ${vertical ? dy : 0}px)` }, { transform: "none" }], { duration: 200, easing: EASE });
  };
  const onCancel = () => {
    pid = -1;
    fig.style.transform = "";
    fig.style.opacity = "";
  };

  const prevent = (e: Event) => {
    if (cur >= 0) e.preventDefault();
  };
  const onResize = () => {
    if (cur >= 0) place(fit(items[cur].w, items[cur].h));
  };

  document.addEventListener("click", onClick);
  document.addEventListener("keydown", onKey);
  document.addEventListener("pointerdown", onDown);
  document.addEventListener("pointermove", onDrag);
  document.addEventListener("pointerup", onUp);
  document.addEventListener("pointercancel", onCancel);
  addEventListener("hashchange", onHash);
  addEventListener("resize", onResize);
  lb.addEventListener("wheel", prevent, { passive: false });
  lb.addEventListener("dragstart", prevent); // a mouse drag must swipe, not pick the picture up
  if (location.hash) onHash();
  if (cur >= 0) pushed = false; // opened by the address itself: closing just drops the hash

  return () => {
    document.removeEventListener("click", onClick);
    document.removeEventListener("keydown", onKey);
    document.removeEventListener("pointerdown", onDown);
    document.removeEventListener("pointermove", onDrag);
    document.removeEventListener("pointerup", onUp);
    document.removeEventListener("pointercancel", onCancel);
    removeEventListener("hashchange", onHash);
    removeEventListener("resize", onResize);
    lb.removeEventListener("wheel", prevent);
    lb.removeEventListener("dragstart", prevent);
    anim?.cancel();
    lb.hidden = true;
    for (const it of items) {
      delete it.img.dataset.lb;
      it.img.removeAttribute("tabindex");
      it.img.removeAttribute("role");
    }
  };
}

// The flight between a tile and the lightbox: the tile shows a centred cover crop of the photograph, so the figure (already at
// its final size) is scaled and moved to put that crop exactly over the tile, and clipped to it. Transform and clip-path only,
// so the browser never re-lays out or re-rasterises the picture mid-flight.
function flight(it: Item, tile: DOMRect, to: Rect) {
  const k = Math.max(tile.width / it.w, tile.height / it.h); // tile px per image px (object-fit: cover)
  const cw = tile.width / k;
  const ch = tile.height / k;
  const cx = (it.w - cw) / 2;
  const cy = (it.h - ch) / 2;
  const s = to.width / it.w; // lightbox px per image px
  const scale = k / s;
  return {
    transform: `translate(${tile.left - to.left - cx * s * scale}px, ${tile.top - to.top - cy * s * scale}px) scale(${scale})`,
    clipPath: `inset(${cy * s}px ${(it.w - cw - cx) * s}px ${(it.h - ch - cy) * s}px ${cx * s}px)`,
  };
}

// Centred and contained, leaving room for the caption bar.
function fit(w: number, h: number): Rect {
  const narrow = innerWidth < 768;
  const side = narrow ? 12 : 48;
  const top = narrow ? 56 : 64;
  const bottom = narrow ? 64 : 76;
  const aw = innerWidth - side * 2;
  const ah = innerHeight - top - bottom;
  const s = Math.min(aw / w, ah / h);
  const width = Math.round(w * s);
  const height = Math.round(h * s);
  return { left: Math.round((innerWidth - width) / 2), top: Math.round(top + (ah - height) / 2), width, height };
}

function captionOf(img: HTMLImageElement): string {
  const text = img.closest("figure")?.querySelector("figcaption")?.textContent ?? img.closest("section")?.querySelector(".caption.on-media")?.textContent ?? img.alt;
  return text.replace(/\s+/g, " ").trim();
}
