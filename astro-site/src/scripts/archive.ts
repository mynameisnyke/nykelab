// Places page: pins ↔ tiles hover sync and the country filter. Years needs no JS (CSS :has).
export function initArchive() {
  const root = document.querySelector<HTMLElement>("[data-archive]");
  if (!root) return;

  const hot = (slug: string | null) => {
    if (slug) root.dataset.hot = slug;
    else delete root.dataset.hot;
    root.querySelectorAll<HTMLElement>("[data-place]").forEach((el) => el.classList.toggle("hot", el.dataset.place === slug));
  };
  root.querySelectorAll<HTMLElement>("[data-place]").forEach((el) => {
    el.addEventListener("mouseenter", () => hot(el.dataset.place!));
    el.addEventListener("focus", () => hot(el.dataset.place!));
    el.addEventListener("mouseleave", () => hot(null));
    el.addEventListener("blur", () => hot(null));
  });

  const buttons = [...root.querySelectorAll<HTMLButtonElement>(".filters button")];
  buttons.forEach((b, i) =>
    b.addEventListener("click", () => {
      const country = i === 0 ? null : b.textContent!.trim().toLowerCase();
      buttons.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      b.classList.add("current");
      buttons.filter((x) => x !== b).forEach((x) => x.classList.remove("current"));
      root.querySelectorAll<HTMLElement>("[data-country]").forEach((card) => (card.hidden = !!country && card.dataset.country!.toLowerCase() !== country));
      root.querySelectorAll<HTMLElement>(".pin").forEach((pin) => {
        const card = root.querySelector<HTMLElement>(`.card[data-place="${pin.dataset.place}"]`);
        pin.classList.toggle("off", !!country && !!card && card.dataset.country!.toLowerCase() !== country);
      });
    }),
  );
}
