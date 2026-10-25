// The hit flash that fires as each photograph lands: a white-hot core, jagged yellow-orange spikes, a shock ring and a few
// flying streaks, drawn on one full-screen canvas. Original artwork in the spirit of an arcade fighter's hit spark.
interface Spike {
  angle: number;
  length: number;
  width: number;
}
interface Streak {
  angle: number;
  speed: number;
  length: number;
}
interface Burst {
  x: number;
  y: number;
  born: number;
  life: number;
  scale: number;
  spikes: Spike[];
  streaks: Streak[];
  rot: number;
}

const easeOut = (t: number) => 1 - (1 - t) ** 3;

export function createHits(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d")!;
  const bursts: Burst[] = [];
  let raf = 0;
  let dpr = 1;

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
  }
  resize();
  window.addEventListener("resize", resize);

  function draw(now: number) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = "lighter";
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i];
      const t = (now - b.born) / b.life;
      if (t >= 1) {
        bursts.splice(i, 1);
        continue;
      }
      const grow = easeOut(Math.min(1, t * 2.2));
      const fade = t < 0.3 ? 1 : 1 - (t - 0.3) / 0.7;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.rot);

      // shock ring
      ctx.beginPath();
      ctx.arc(0, 0, (30 + easeOut(t) * 150) * b.scale, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 214, 120, ${0.55 * fade * (1 - t)})`;
      ctx.lineWidth = 3 * (1 - t) + 0.5;
      ctx.stroke();

      // jagged spikes: thin triangles that snap out, white at the root, orange at the tip
      for (const s of b.spikes) {
        const len = s.length * b.scale * grow;
        const w = s.width * b.scale * (1 - t * 0.6);
        const g = ctx.createLinearGradient(0, 0, Math.cos(s.angle) * len, Math.sin(s.angle) * len);
        g.addColorStop(0, `rgba(255, 255, 255, ${fade})`);
        g.addColorStop(0.45, `rgba(255, 236, 120, ${0.9 * fade})`);
        g.addColorStop(1, "rgba(255, 110, 20, 0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(Math.cos(s.angle + Math.PI / 2) * w, Math.sin(s.angle + Math.PI / 2) * w);
        ctx.lineTo(Math.cos(s.angle) * len, Math.sin(s.angle) * len);
        ctx.lineTo(Math.cos(s.angle - Math.PI / 2) * w, Math.sin(s.angle - Math.PI / 2) * w);
        ctx.closePath();
        ctx.fill();
      }

      // flying streaks
      ctx.lineCap = "round";
      for (const s of b.streaks) {
        const d = easeOut(t) * s.speed * b.scale;
        ctx.strokeStyle = `rgba(255, 245, 200, ${0.9 * fade})`;
        ctx.lineWidth = 2.2 * (1 - t * 0.7);
        ctx.beginPath();
        ctx.moveTo(Math.cos(s.angle) * d, Math.sin(s.angle) * d);
        ctx.lineTo(Math.cos(s.angle) * (d + s.length * b.scale * (1 - t)), Math.sin(s.angle) * (d + s.length * b.scale * (1 - t)));
        ctx.stroke();
      }

      // white-hot core, brightest in the first moments
      const r = (70 * (1 - t * 0.55) + 20) * b.scale;
      const core = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      core.addColorStop(0, `rgba(255, 255, 255, ${Math.min(1, 1.4 * fade)})`);
      core.addColorStop(0.35, `rgba(255, 240, 150, ${0.8 * fade})`);
      core.addColorStop(1, "rgba(255, 140, 30, 0)");
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalCompositeOperation = "source-over";
    raf = bursts.length ? requestAnimationFrame(draw) : 0;
  }

  /** A flash at viewport coordinates (x, y). `scale` 1 is a normal hit. */
  function burst(x: number, y: number, scale = 1) {
    const n = 9 + Math.floor(Math.random() * 5);
    const spikes: Spike[] = Array.from({ length: n }, (_, i) => ({
      angle: (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.45,
      length: (i % 2 ? 70 : 150) + Math.random() * 90,
      width: 5 + Math.random() * 9,
    }));
    const streaks: Streak[] = Array.from({ length: 12 }, () => ({ angle: Math.random() * Math.PI * 2, speed: 90 + Math.random() * 190, length: 14 + Math.random() * 30 }));
    bursts.push({ x, y, born: performance.now(), life: 480, scale, spikes, streaks, rot: Math.random() * Math.PI });
    if (!raf) raf = requestAnimationFrame(draw);
  }

  return {
    burst,
    destroy() {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      bursts.length = 0;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    },
  };
}
