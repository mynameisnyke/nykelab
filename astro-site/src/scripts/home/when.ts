// WHEN: every photograph as a dot — date across, time of day down. Golden hour shows up
// by itself as two bands. Drag across the dates to filter the other views.
import * as d3 from "d3";
import { sunTimes, type Shot } from "../../lib/voyages";
import type { Store } from "./store";

const DAY = 864e5;
const HOURS = [0, 6, 12, 18, 24];
const HOUR_LABEL = ["12 AM", "6 AM", "Noon", "6 PM", "12 AM"];

export function createWhen(host: HTMLElement, store: Store) {
  const { shots, voyages } = store.data;
  const svg = d3.select(host).append("svg").style("width", "100%").style("height", "100%").style("display", "block");

  let dots: d3.Selection<SVGCircleElement, Shot, SVGGElement, unknown> | null = null;
  let brushG: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;
  let brush: d3.BrushBehavior<unknown> | null = null;
  let xScale: d3.ScaleTime<number, number> | null = null;
  let quad: d3.Quadtree<{ x: number; y: number; i: number }> | null = null;
  let programmatic = false;

  const label = (s: d3.Selection<SVGTextElement, unknown, null, undefined>) =>
    s
      .style("font-family", "var(--font-data)")
      .style("font-weight", "400")
      .style("font-size", "10px")
      .style("letter-spacing", "0.04em")
      .style("text-transform", "uppercase")
      .style("fill", "var(--text-caption)");

  function draw() {
    const W = host.clientWidth;
    const H = host.clientHeight;
    if (!W || !H) return;
    const m = { t: 6, r: 12, b: 30, l: 52 };
    const w = W - m.l - m.r;
    const h = H - m.t - m.b;
    svg.attr("viewBox", `0 0 ${W} ${H}`).selectAll("*").remove();
    const g = svg.append("g").attr("transform", `translate(${m.l},${m.t})`);

    const t0 = d3.min(shots, (s) => s.t)!;
    const t1 = d3.max(shots, (s) => s.t)!;
    const x = d3.scaleTime([new Date(t0 - 40 * DAY), new Date(t1 + 40 * DAY)], [0, w]);
    const y = d3.scaleLinear([0, 24], [0, h]);
    xScale = x;

    // Night, at a mid latitude (reference only; each dot is placed by its own capture time).
    const days = d3.range(+x.domain()[0], +x.domain()[1] + 4 * DAY, 4 * DAY);
    const rise = (d: number) => y(sunTimes(40, d).rise);
    const set = (d: number) => y(sunTimes(40, d).set);
    g.append("path")
      .attr("d", d3.area<number>().x((d) => x(d)).y0(0).y1(rise)(days))
      .style("fill", "var(--fill-ring-soft)");
    g.append("path")
      .attr("d", d3.area<number>().x((d) => x(d)).y0(set).y1(h)(days))
      .style("fill", "var(--fill-ring-soft)");
    for (const f of [rise, set]) {
      g.append("path")
        .attr("d", d3.line<number>().x((d) => x(d)).y(f)(days))
        .style("fill", "none")
        .style("stroke", "var(--border-subtle)")
        .style("stroke-dasharray", "3 4");
    }

    // Hour grid
    HOURS.forEach((hr, i) => {
      g.append("line").attr("x1", 0).attr("x2", w).attr("y1", y(hr)).attr("y2", y(hr)).style("stroke", "var(--border-subtle)");
      g.append("text").call(label).attr("x", -10).attr("y", y(hr) + 3).attr("text-anchor", "end").text(HOUR_LABEL[i]);
    });

    // Year axis
    d3.timeYear.range(x.domain()[0], x.domain()[1]).forEach((yr) => {
      const px = x(yr);
      if (px < 0 || px > w - 36) return;
      g.append("line").attr("x1", px).attr("x2", px).attr("y1", 0).attr("y2", h).style("stroke", "var(--border-subtle)");
      g.append("text").call(label).attr("x", px + 6).attr("y", h + 18).text(yr.getUTCFullYear());
    });

    // Voyage spans, faintly behind the dots
    voyages.forEach((v) => {
      const x0 = x(new Date(v.start - DAY / 2));
      g.append("rect")
        .attr("x", x0)
        .attr("y", 0)
        .attr("width", Math.max(5, x(new Date(v.end + DAY / 2)) - x0))
        .attr("height", h)
        .attr("fill", v.color)
        .attr("fill-opacity", 0.1);
    });

    dots = g
      .append("g")
      .selectAll<SVGCircleElement, Shot>("circle")
      .data(shots)
      .join("circle")
      .attr("cx", (s) => x(new Date(s.t)))
      .attr("cy", (s) => y(s.hour))
      .attr("fill", (s) => voyages[s.v].color)
      .style("stroke-width", 1.5)
      .style("pointer-events", "none");
    shown = { o: [], r: [], s: [] }; // fresh circles: nothing is painted yet

    quad = d3
      .quadtree<{ x: number; y: number; i: number }>()
      .x((d) => d.x)
      .y((d) => d.y)
      .addAll(shots.map((s, i) => ({ x: x(new Date(s.t)), y: y(s.hour), i })));

    brush = d3
      .brushX()
      .extent([
        [0, 0],
        [w, h],
      ])
      .on("brush end", (ev: d3.D3BrushEvent<unknown>) => {
        if (programmatic) return;
        if (!ev.selection) {
          if (ev.type === "end") store.set({ range: null });
          return;
        }
        const [a, b] = (ev.selection as [number, number]).map((px) => +x.invert(px));
        store.set({ range: [a, b] });
      });
    brushG = g.append("g").call(brush);
    brushG.select(".selection").style("fill", "var(--fill-ring-soft)").style("stroke", "var(--border-strong)").style("fill-opacity", 1);

    const overlay = brushG.select<SVGRectElement>(".overlay");
    overlay.style("cursor", "crosshair");
    overlay.on("pointermove", (ev: PointerEvent) => {
      const [mx, my] = d3.pointer(ev, g.node());
      const hit = quad!.find(mx, my, 18);
      if (hit) {
        store.set({ hoverShot: hit.i, hoverV: shots[hit.i].v });
        return;
      }
      const t = +x.invert(mx);
      const v = voyages.findIndex((vo) => t >= vo.start - DAY && t <= vo.end + DAY);
      store.set({ hoverShot: null, hoverV: v >= 0 ? v : null });
    });
    overlay.on("pointerleave", () => store.set({ hoverShot: null, hoverV: null }));

    syncBrush();
    update();
  }

  function syncBrush() {
    if (!brushG || !brush || !xScale) return;
    programmatic = true;
    const r = store.state.range;
    brushG.call(brush.move, r ? [xScale(new Date(r[0])), xScale(new Date(r[1]))] : null);
    programmatic = false;
  }

  // With thousands of dots, rewriting every attribute on every hover is far too slow: remember what each dot
  // currently shows and only touch the DOM for the ones that change.
  let shown: { o: number[]; r: number[]; s: boolean[] } = { o: [], r: [], s: [] };

  function update() {
    if (!dots) return;
    const active = store.activeV();
    const hot = store.state.hoverShot;
    const nodes = dots.nodes();
    if (shown.o.length !== nodes.length) shown = { o: new Array(nodes.length).fill(NaN), r: new Array(nodes.length).fill(NaN), s: new Array(nodes.length).fill(false) };
    for (let i = 0; i < nodes.length; i++) {
      const sh = shots[i];
      const o = !store.visible(sh) ? 0.07 : active !== null && sh.v !== active ? 0.28 : 0.95;
      const r = i === hot ? 6.5 : 3.4;
      const st = i === hot;
      const el = nodes[i];
      if (shown.o[i] !== o) ((shown.o[i] = o), el.setAttribute("fill-opacity", String(o)));
      if (shown.r[i] !== r) ((shown.r[i] = r), el.setAttribute("r", String(r)));
      if (shown.s[i] !== st) ((shown.s[i] = st), (el.style.stroke = st ? "var(--text-primary)" : "none"));
    }
  }

  const ro = new ResizeObserver(draw);
  ro.observe(host);
  const unsub = store.subscribe(() => {
    update();
    if (!store.state.range) syncBrush();
  });
  draw();

  return {
    destroy() {
      ro.disconnect();
      unsub();
      svg.remove();
    },
  };
}
