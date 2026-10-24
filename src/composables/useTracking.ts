import { onBeforeUnmount, onMounted, type Ref } from "vue";

// First-party analytics: events go to /api/event (Cloudflare Analytics Engine).
// No cookies, no personal data — just event type, media id, path, device class.
type EventType = "page_view" | "media_view" | "video_play" | "video_progress";

interface TrackPayload {
  id?: string;
  collection?: string;
  path?: string;
  value?: number;
}

const VIEW_DWELL_MS = 1000;
const isMobile = () => /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

let sentReferrer = false;

export function track(type: EventType, extra: TrackPayload = {}) {
  const path = extra.path ?? location.pathname;
  if (path.startsWith("/admin")) return;

  let referrer = "";
  if (!sentReferrer && type === "page_view") {
    sentReferrer = true;
    try {
      referrer = document.referrer ? new URL(document.referrer).host : "";
    } catch {
      // malformed referrer
    }
  }

  const body = JSON.stringify({ type, ...extra, path, mobile: isMobile(), referrer });
  try {
    if (!navigator.sendBeacon?.("/api/event", new Blob([body], { type: "application/json" }))) {
      fetch("/api/event", { method: "POST", body, keepalive: true }).catch(() => {});
    }
  } catch {
    // analytics must never break the page
  }
}

// Each item counts once per page load, however often it scrolls in and out.
const viewed = new Set<string>();
const MILESTONES = [25, 50, 75, 100];

/**
 * Fires media_view once an item has been >=50% visible for 1s. For <video>
 * elements it also fires video_play at that point and video_progress at
 * 25/50/75/100% (100 = loop wrapped) while the video is on screen.
 */
export function useMediaTracking(
  el: Ref<HTMLElement | null>,
  media: { id: string; collection?: string },
) {
  let observer: IntersectionObserver | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let visible = false;
  let video: HTMLVideoElement | null = null;
  const fired = new Set<number>();
  let lastTime = 0;

  const onTimeUpdate = () => {
    if (!video || !visible || !Number.isFinite(video.duration) || video.duration <= 0) return;
    const pct = (video.currentTime / video.duration) * 100;
    // Looping videos never fire "ended": a backwards jump after >90% is a completion.
    if (video.currentTime < lastTime && lastTime / video.duration > 0.9) {
      emitProgress(100);
    }
    lastTime = video.currentTime;
    for (const m of MILESTONES) {
      if (m < 100 && pct >= m) emitProgress(m);
    }
  };

  const emitProgress = (m: number) => {
    if (fired.has(m)) return;
    fired.add(m);
    track("video_progress", { id: media.id, collection: media.collection, value: m });
  };

  onMounted(() => {
    if (!el.value || !media.id || !("IntersectionObserver" in window)) return;
    video = el.value.querySelector("video");
    video?.addEventListener("timeupdate", onTimeUpdate);

    observer = new IntersectionObserver(
      (entries) => {
        visible = entries.some((e) => e.isIntersecting);
        if (visible && !timer && !viewed.has(media.id)) {
          timer = setTimeout(() => {
            timer = null;
            if (!visible || viewed.has(media.id)) return;
            viewed.add(media.id);
            track("media_view", { id: media.id, collection: media.collection });
            if (video) track("video_play", { id: media.id, collection: media.collection });
          }, VIEW_DWELL_MS);
        } else if (!visible && timer) {
          clearTimeout(timer);
          timer = null;
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(el.value);
  });

  onBeforeUnmount(() => {
    observer?.disconnect();
    if (timer) clearTimeout(timer);
    video?.removeEventListener("timeupdate", onTimeUpdate);
  });
}

/** For non-DOM contexts (e.g. the 3D gallery lightbox): count one view per id. */
export function trackMediaOnce(media: { id: string; collection?: string }) {
  if (!media.id || viewed.has(media.id)) return;
  viewed.add(media.id);
  track("media_view", { id: media.id, collection: media.collection });
}
