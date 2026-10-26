// The voyage list as a split-flap departure board: each letter tile flips through a few
// random characters, row by row, then settles on the real one. Once per visit; not at all
// with reduced motion.
const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const FLIP = 110; // ms for one flip
const SHUFFLES = 2; // random characters before the real one

export function flipBoard(list: HTMLElement): () => void {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};
  const timers: number[] = [];
  const anims: Animation[] = [];
  const letters = new Map<HTMLElement, string>();
  list.querySelectorAll<HTMLElement>("li").forEach((li, row) => {
    li.querySelectorAll<HTMLElement>(".flap").forEach((tile, col) => {
      const letter = tile.textContent ?? "";
      letters.set(tile, letter);
      for (let step = 0; step <= SHUFFLES; step++) {
        const at = row * 45 + col * 30 + step * FLIP;
        timers.push(
          window.setTimeout(() => {
            anims.push(tile.animate([{ transform: "rotateX(0)" }, { transform: "rotateX(-90deg)" }, { transform: "rotateX(0)" }], { duration: FLIP, easing: "ease-in-out" }));
            timers.push(window.setTimeout(() => (tile.textContent = step === SHUFFLES ? letter : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]), FLIP / 2));
          }, at),
        );
      }
    });
  });
  return () => {
    timers.forEach(clearTimeout);
    anims.forEach((a) => a.cancel());
    letters.forEach((letter, tile) => (tile.textContent = letter));
  };
}
