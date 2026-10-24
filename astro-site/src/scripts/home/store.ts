// Tiny shared state so the three views (and the list / preview) stay linked.
import type { HomeData, Shot } from "../../lib/voyages";

export type Lens = "where" | "when" | "how";

export interface State {
  lens: Lens;
  hoverV: number | null; // voyage under the pointer (any view or the list)
  pinV: number | null; // voyage chosen by tap (touch)
  hoverShot: number | null; // single photograph under the pointer
  range: [number, number] | null; // When: brushed date range (epoch ms)
  gear: { focal: number; f: number } | null; // How: clicked focal/aperture bubble
}

export function createStore(data: HomeData) {
  const state: State = { lens: "where", hoverV: null, pinV: null, hoverShot: null, range: null, gear: null };
  const subs = new Set<() => void>();

  const visible = (s: Shot) =>
    (!state.range || (s.t >= state.range[0] && s.t <= state.range[1])) &&
    (!state.gear || (s.focal === state.gear.focal && s.f === state.gear.f));

  return {
    data,
    state,
    set(patch: Partial<State>) {
      let changed = false;
      for (const k of Object.keys(patch) as (keyof State)[]) {
        if (JSON.stringify(state[k]) !== JSON.stringify(patch[k])) changed = true;
      }
      if (!changed) return;
      Object.assign(state, patch);
      subs.forEach((f) => f());
    },
    subscribe(fn: () => void) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    visible,
    visibleShots: () => data.shots.filter(visible),
    activeV: () => state.hoverV ?? state.pinV,
  };
}

export type Store = ReturnType<typeof createStore>;
