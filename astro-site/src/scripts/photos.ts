// Behaviour for photo pages: fade items in/out on scroll, and report views.
// Replaces GSAP fades + useMediaTracking from the Vue components.
import { track } from "../lib/track";

const VIEW_DWELL_MS = 1000;
const MILESTONES = [25, 50, 75];
const viewed = new Set<string>(); // each item counts once per page load

export function initPhotos() {
  const reveal = new IntersectionObserver(
    (entries) => entries.forEach((e) => e.target.classList.toggle("in", e.isIntersecting)),
    { threshold: 0.1 },
  );
  document.querySelectorAll(".reveal").forEach((el) => reveal.observe(el));

  const timers = new WeakMap<Element, number>();
  const seen = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const el = e.target as HTMLElement;
        const id = el.dataset.id!;
        if (!e.isIntersecting || e.intersectionRatio < 0.5) {
          clearTimeout(timers.get(el));
          continue;
        }
        if (viewed.has(id)) continue;
        timers.set(
          el,
          window.setTimeout(() => {
            viewed.add(id);
            const extra = { id, collection: el.dataset.collection };
            track("media_view", extra);
            if (el instanceof HTMLVideoElement) watchVideo(el, extra);
          }, VIEW_DWELL_MS),
        );
      }
    },
    { threshold: [0, 0.5] },
  );
  document.querySelectorAll<HTMLElement>("[data-media]").forEach((el) => seen.observe(el));
}

function watchVideo(v: HTMLVideoElement, extra: { id: string; collection?: string }) {
  track("video_play", extra);
  const fired = new Set<number>();
  let last = 0;
  v.addEventListener("timeupdate", () => {
    if (!Number.isFinite(v.duration) || v.duration <= 0) return;
    const pct = (v.currentTime / v.duration) * 100;
    // Looping videos never fire "ended": a backwards jump after >90% is a completion.
    if (v.currentTime < last && last / v.duration > 0.9 && !fired.has(100)) {
      fired.add(100);
      track("video_progress", { ...extra, value: 100 });
    }
    last = v.currentTime;
    for (const m of MILESTONES) {
      if (pct >= m && !fired.has(m)) {
        fired.add(m);
        track("video_progress", { ...extra, value: m });
      }
    }
  });
}
