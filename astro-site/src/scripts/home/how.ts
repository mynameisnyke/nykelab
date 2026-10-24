// HOW: focal length (across) against aperture (down). Bubble size = photographs made at
// that exact setting. Click a bubble to filter the other views to it.
import * as d3 from "d3";
import type { Store } from "./store";

const FOCALS = [14, 24, 35, 50, 85, 100, 200, 400];
const APERTURES = [1.4, 2, 2.8, 4, 5.6, 8, 11, 16, 22];

interface Bubble {
  focal: number;
  f: number;
  idx: number[]; // indices into shots
}

export function createHow(host: HTMLElement, store: Store) {
  const { shots, voyages } = store.data;
  const svg = d3.select(host).append("svg").style("width", "100%").style("height", "100%").style("display", "block");

  const groups = d3.group(shots.map((s, i) => ({ s, i })), (d) => `${d.s.focal}|${d.s.f}`);
  const bubbles: Bubble[] = [...groups.values()].map((rows) => ({ focal: rows[0].s.focal, f: rows[0].s.f, idx: rows.map((r) => r.i) }));

  let base: d3.Selection<SVGCircleElement, Bubble, SVGGElement, unknown> | null = null;
  let inner: d3.Selection<SVGCircleElement, Bubble, SVGGElement, unknown> | null = null;
  let rScale: d3.ScalePower<number, number> | null = null;

  const label = (s: d3.Selection<SVGTextElement, unknown, null, undefined>) =>
    s
      .style("font-family", "var(--font-ui)")
      .style("font-weight", "500")
      .style("font-size", "10px")
      .style("letter-spacing", "0.1em")
      .style("text-transform", "uppercase")
      .style("fill", "var(--text-caption)");

  const visibleIn = (b: Bubble, v?: number) => b.idx.filter((i) => store.visible(shots[i]) && (v === undefined || shots[i].v === v));

  function draw() {
    const W = host.clientWidth;
    const H = host.clientHeight;
    if (!W || !H) return;
    const m = { t: 14, r: 24, b: 34, l: 56 };
    const w = W - m.l - m.r;
    const h = H - m.t - m.b;
    svg.attr("viewBox", `0 0 ${W} ${H}`).selectAll("*").remove();
    const g = svg.append("g").attr("transform", `translate(${m.l},${m.t})`);

    const x = d3.scaleLog([12, 480], [0, w]);
    const y = d3.scaleLog([1.2, 26], [0, h]);
    const maxN = d3.max(bubbles, (b) => b.idx.length) ?? 1;
    rScale = d3.scaleSqrt([0, maxN], [0, Math.min(34, Math.max(18, w / 16))]);

    let lastLabelX = -Infinity;
    FOCALS.forEach((f) => {
      g.append("line").attr("x1", x(f)).attr("x2", x(f)).attr("y1", 0).attr("y2", h).style("stroke", "var(--border-subtle)");
      // Skip a label when it would collide with the previous one (log scale bunches the short end).
      if (x(f) - lastLabelX >= 44) {
        g.append("text").call(label).attr("x", x(f)).attr("y", h + 20).attr("text-anchor", "middle").text(`${f}mm`);
        lastLabelX = x(f);
      }
    });
    APERTURES.forEach((a) => {
      g.append("line").attr("x1", 0).attr("x2", w).attr("y1", y(a)).attr("y2", y(a)).style("stroke", "var(--border-subtle)");
      g.append("text").call(label).attr("x", -10).attr("y", y(a) + 3).attr("text-anchor", "end").text(`f/${a}`);
    });

    base = g
      .append("g")
      .selectAll<SVGCircleElement, Bubble>("circle")
      .data(bubbles)
      .join("circle")
      .attr("cx", (b) => x(b.focal))
      .attr("cy", (b) => y(b.f))
      .style("fill", "var(--text-primary)")
      .style("stroke", "var(--text-primary)")
      .style("cursor", "pointer")
      .on("pointerenter", (_, b) => {
        const first = visibleIn(b)[0] ?? b.idx[0];
        store.set({ hoverShot: first, hoverV: null });
      })
      .on("pointerleave", () => store.set({ hoverShot: null }))
      .on("click", (_, b) => {
        const cur = store.state.gear;
        store.set({ gear: cur && cur.focal === b.focal && cur.f === b.f ? null : { focal: b.focal, f: b.f } });
      });

    // Share of the hovered voyage inside each bubble, in that voyage's color.
    inner = g
      .append("g")
      .selectAll<SVGCircleElement, Bubble>("circle")
      .data(bubbles)
      .join("circle")
      .attr("cx", (b) => x(b.focal))
      .attr("cy", (b) => y(b.f))
      .style("pointer-events", "none");

    update();
  }

  function update() {
    if (!base || !inner || !rScale) return;
    const rs = rScale;
    const active = store.activeV();
    const gear = store.state.gear;
    base
      .attr("r", (b) => {
        const n = visibleIn(b).length;
        return n ? rs(n) : 2.5;
      })
      .style("fill-opacity", (b) => (gear && gear.focal === b.focal && gear.f === b.f ? 0.38 : visibleIn(b).length ? 0.13 : 0.04))
      .style("stroke-opacity", (b) => (gear && gear.focal === b.focal && gear.f === b.f ? 0.95 : visibleIn(b).length ? 0.5 : 0.15));
    inner
      .attr("r", (b) => (active === null ? 0 : rs(visibleIn(b, active).length)))
      .attr("fill", () => (active === null ? "none" : voyages[active].color))
      .attr("fill-opacity", 0.9);
  }

  const ro = new ResizeObserver(draw);
  ro.observe(host);
  const unsub = store.subscribe(update);
  draw();

  return {
    destroy() {
      ro.disconnect();
      unsub();
      svg.remove();
    },
  };
}
