<template>
  <p v-if="!media.length" class="text-sm text-white/40 py-8 text-center">Nothing here yet.</p>
  <ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    <li v-for="(m, i) in media" :key="m.id" class="rounded border border-white/15 overflow-hidden flex flex-col">
      <div class="relative bg-white/5 aspect-[4/3]">
        <img :src="thumb(m)" class="w-full h-full object-cover" :class="{ 'opacity-40': !m.published }" loading="lazy" />
        <span v-if="m.type === 'video'" class="badge left-2 top-2">VIDEO</span>
        <span v-if="!m.published" class="badge right-2 top-2">DRAFT</span>
        <span v-if="views[m.id] !== undefined" class="badge left-2 bottom-2">{{ views[m.id] }} views</span>
      </div>
      <div class="p-3 space-y-2 flex-1 flex flex-col">
        <textarea
          v-model="edits[m.id].caption"
          rows="2"
          placeholder="Caption (blank = from the photo's tags)"
          class="field w-full"
          @blur="save(m, 'caption')"
        ></textarea>
        <input
          v-model="edits[m.id].place"
          placeholder="Place (blank = from the photo's GPS or tags)"
          class="field w-full"
          @blur="save(m, 'place')"
        />
        <p class="text-[11px] leading-4 text-white/45">
          <span v-if="m.placeSource === 'gps'">Place from the photo's GPS (shown as the city only).</span>
          <span v-else-if="m.placeSource === 'tags'">Place from the photo's location tags.</span>
          <span v-else-if="m.placeSource === 'manual'">Place typed by you.</span>
          <span v-else>No place in the photo yet.</span>
          <span v-if="m.captionSource === 'photo'"> Caption from the photo.</span>
          <span v-if="m.capturedAt || m.camera"><br />{{ details(m) }}</span>
        </p>
        <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/70">
          <label class="flex items-center gap-1">
            <input type="checkbox" :checked="m.published" @change="toggle(m, 'published', $event)" /> Published
          </label>
          <label v-if="m.type === 'image'" class="flex items-center gap-1" title="Show in the walkable /world gallery">
            <input type="checkbox" :checked="m.featured" @change="toggle(m, 'featured', $event)" /> In World
          </label>
        </div>
        <div class="mt-auto flex items-center justify-between gap-2 pt-2">
          <select :value="m.collection" class="field text-xs" @change="move(m, $event)">
            <option v-for="c in collections" :key="c.slug" :value="c.slug">{{ c.title }}</option>
          </select>
          <div class="flex gap-1">
            <button v-if="reorderable" class="btn" :disabled="i === 0" @click="shift(i, -1)" aria-label="Move earlier">↑</button>
            <button v-if="reorderable" class="btn" :disabled="i === media.length - 1" @click="shift(i, 1)" aria-label="Move later">↓</button>
            <button v-if="m.type === 'image'" class="btn" title="Read caption, place and camera data from the file again" @click="reread(m)">Re-read</button>
            <button class="btn btn--danger" @click="remove(m)">Delete</button>
          </div>
        </div>
      </div>
    </li>
  </ul>
</template>

<script setup lang="ts">
import { reactive, watch } from "vue";
import { admin, type AdminCollection, type ApiMedia } from "../lib/api";
import { useToast } from "../lib/useToast";

const props = defineProps<{
  media: ApiMedia[];
  collections: AdminCollection[];
  // Reordering only makes sense within a single collection.
  reorderable: boolean;
  views: Record<string, number>;
}>();
const emit = defineEmits<{ (e: "changed"): void }>();
const { show, fail } = useToast();

const edits = reactive<Record<string, { caption: string; place: string }>>({});
// Last server values, so a refresh only overwrites fields the user hasn't touched.
const synced: Record<string, { caption: string; place: string }> = {};
watch(
  () => props.media,
  (list) => {
    for (const m of list) {
      const e = edits[m.id];
      const s = synced[m.id];
      if (!e || !s) {
        edits[m.id] = { caption: m.caption, place: m.place };
      } else {
        if (e.caption === s.caption) e.caption = m.caption;
        if (e.place === s.place) e.place = m.place;
      }
      synced[m.id] = { caption: m.caption, place: m.place };
    }
  },
  { immediate: true },
);

// "Jan 30, 2020 · SONY ILCE-7M3 · 85mm f/1.8 · 1/250 · ISO 400"
function details(m: ApiMedia) {
  const when = m.capturedAt ? new Date(`${m.capturedAt}Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "";
  const gear = [m.focal ? `${Math.round(m.focal)}mm` : "", m.aperture ? `f/${m.aperture}` : "", m.shutter || "", m.iso ? `ISO ${m.iso}` : ""].filter(Boolean).join(" · ");
  return [when, m.camera, gear].filter(Boolean).join(" · ");
}

const thumb = (m: ApiMedia) => m.urls.small ?? m.urls.poster ?? m.urls.main;

async function run(fn: () => Promise<unknown>, ok?: string) {
  try {
    await fn();
    if (ok) show(ok);
    emit("changed");
  } catch (err) {
    fail(err);
  }
}

const save = (m: ApiMedia, field: "caption" | "place") => {
  if (edits[m.id][field] === m[field]) return;
  run(() => admin.updateMedia(m.id, { [field]: edits[m.id][field] }), "Saved");
};
const reread = (m: ApiMedia) => run(() => admin.readMetadata(m.id), "Read from the photo");
const toggle = (m: ApiMedia, field: "published" | "featured", e: Event) =>
  run(() => admin.updateMedia(m.id, { [field]: (e.target as HTMLInputElement).checked }));
const move = (m: ApiMedia, e: Event) =>
  run(() => admin.updateMedia(m.id, { collection: (e.target as HTMLSelectElement).value }), "Moved");
const remove = (m: ApiMedia) => {
  if (!confirm("Delete this permanently? The file is removed from storage.")) return;
  run(() => admin.deleteMedia(m.id), "Deleted");
};
const shift = (i: number, dir: -1 | 1) => {
  const ids = props.media.map((m) => m.id);
  [ids[i], ids[i + dir]] = [ids[i + dir], ids[i]];
  run(() => admin.orderMedia(props.media[i].collection, ids));
};
</script>

<style scoped>
.field {
  background: #111;
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #fff;
  padding: 0.35rem 0.5rem;
  font-size: 0.875rem;
}
.badge {
  position: absolute;
  background: rgba(0, 0, 0, 0.7);
  font-size: 0.65rem;
  letter-spacing: 0.06em;
  padding: 0.15rem 0.4rem;
}
.btn {
  border: 1px solid rgba(255, 255, 255, 0.25);
  padding: 0.25rem 0.6rem;
  font-size: 0.75rem;
}
.btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
}
.btn:disabled {
  opacity: 0.3;
}
.btn--danger:hover {
  background: rgba(255, 60, 60, 0.25) !important;
}
</style>
