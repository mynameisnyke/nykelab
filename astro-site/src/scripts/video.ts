// Background-style video: always muted, inline and looping, and playing only while it is on screen.
//  - the file is not requested until the clip is about a screen away, so a page of videos does not download all at once
//  - it plays while at least a quarter of it is visible and pauses when it scrolls out (or the tab is hidden)
//  - with "reduce motion" or Data Saver on, nothing plays: the poster image stays
const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const saveData = () => (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;

export function initVideos(): () => void {
  const videos = [...document.querySelectorAll<HTMLVideoElement>("video[data-media]")];
  if (!videos.length) return () => {};
  for (const v of videos) {
    v.muted = true; // the attribute alone is not always enough for autoplay rules
    v.playsInline = true;
  }
  if (reducedMotion() || saveData()) {
    for (const v of videos) v.loop = false; // poster only
    return () => {};
  }

  const inView = new Set<HTMLVideoElement>();
  const attach = (v: HTMLVideoElement) => {
    if (!v.src && v.dataset.src) {
      v.src = v.dataset.src;
      v.load();
    }
  };
  const play = (v: HTMLVideoElement) => void v.play().catch(() => {}); // a blocked or interrupted play() is harmless

  const loader = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        attach(e.target as HTMLVideoElement);
        loader.unobserve(e.target);
      }),
    { rootMargin: "100% 0px" },
  );
  const player = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        const v = e.target as HTMLVideoElement;
        if (e.isIntersecting) {
          inView.add(v);
          attach(v);
          if (!document.hidden) play(v);
        } else {
          inView.delete(v);
          v.pause();
        }
      }),
    { threshold: 0.25 },
  );
  const onVisibility = () => {
    for (const v of inView) document.hidden ? v.pause() : play(v);
  };

  for (const v of videos) {
    if (v.dataset.eager !== undefined) attach(v); // the hero starts loading immediately
    loader.observe(v);
    player.observe(v);
  }
  document.addEventListener("visibilitychange", onVisibility);
  return () => {
    loader.disconnect();
    player.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
    for (const v of videos) v.pause();
  };
}
