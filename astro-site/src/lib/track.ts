// First-party, cookie-less analytics → POST /api/event (Cloudflare Analytics Engine).
// Same payload as the Vue app's useTracking.ts; no personal data.
export type EventType = "page_view" | "media_view" | "video_play" | "video_progress";

interface Extra {
  id?: string;
  collection?: string;
  path?: string;
  value?: number;
}

const isMobile = () => /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
let sentReferrer = false;

export function track(type: EventType, extra: Extra = {}) {
  const path = extra.path ?? location.pathname;
  if (path.startsWith("/admin")) return;

  let referrer = "";
  if (!sentReferrer && type === "page_view") {
    sentReferrer = true;
    try {
      referrer = document.referrer ? new URL(document.referrer).host : "";
    } catch {}
  }
  const body = JSON.stringify({ type, ...extra, path, mobile: isMobile(), referrer });
  try {
    if (!navigator.sendBeacon?.("/api/event", new Blob([body], { type: "application/json" }))) {
      fetch("/api/event", { method: "POST", body, keepalive: true }).catch(() => {});
    }
  } catch {}
}
