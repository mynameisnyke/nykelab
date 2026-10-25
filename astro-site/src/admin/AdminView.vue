<template>
  <div class="min-h-screen bg-black text-white">
    <header class="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-white/10">
      <div class="flex items-baseline gap-3">
        <h1 class="flex items-center gap-2 text-sm font-semibold tracking-widest">
          <svg class="h-4 w-4" viewBox="1.5 2 21 23.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11 9.5 17.5 21 3.5M9.5 17.5V24" /></svg>
          NYKELAB <span class="text-white/40">ADMIN</span>
        </h1>
        <a href="/" class="text-xs text-white/50 hover:text-white">View site ↗</a>
      </div>
      <span class="text-xs text-white/40">{{ email }}</span>
    </header>

    <nav class="flex gap-6 px-6 pt-4 text-sm">
      <button v-for="t in tabs" :key="t.id" class="tab" :class="{ 'tab--on': tab === t.id }" @click="tab = t.id">
        {{ t.label }}
      </button>
    </nav>

    <main class="px-6 py-6 space-y-6">
      <p v-if="loadError" class="text-sm text-red-400">{{ loadError }}</p>

      <template v-if="tab === 'library'">
        <UploadPanel :collections="collections" :selected="filter" @uploaded="refresh" />

        <div class="flex flex-wrap gap-2">
          <button class="pill" :class="{ 'pill--on': filter === '' }" @click="filter = ''">
            All ({{ allMedia.length }})
          </button>
          <button
            v-for="c in collections"
            :key="c.slug"
            class="pill"
            :class="{ 'pill--on': filter === c.slug }"
            @click="filter = c.slug"
          >
            {{ c.title }} ({{ c.count }})
          </button>
          <button
            class="pill ml-auto"
            :disabled="rereading"
            title="Read caption, place and camera data from every photo shown (typed values are kept)"
            @click="rereadAll"
          >
            {{ rereading ? "Reading…" : "Re-read all from photos" }}
          </button>
        </div>

        <MediaGrid
          :media="visibleMedia"
          :collections="collections"
          :reorderable="!!filter"
          :views="viewCounts"
          @changed="refresh"
        />
      </template>

      <CollectionsPanel v-else-if="tab === 'collections'" :collections="collections" @changed="refresh" />
      <StatsPanel v-else :media="allMedia" />
    </main>

    <transition name="toast">
      <div v-if="toast" class="toast" :class="{ 'toast--error': toastKind === 'error' }">{{ toast }}</div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { admin, type AdminCollection, type ApiMedia } from "./lib/api";
import { useToast } from "./lib/useToast";
import UploadPanel from "./components/UploadPanel.vue";
import MediaGrid from "./components/MediaGrid.vue";
import CollectionsPanel from "./components/CollectionsPanel.vue";
import StatsPanel from "./components/StatsPanel.vue";

const tabs = [
  { id: "library", label: "Library" },
  { id: "collections", label: "Collections" },
  { id: "stats", label: "Stats" },
] as const;

const { message: toast, kind: toastKind, show, fail } = useToast();
const tab = ref<(typeof tabs)[number]["id"]>("library");
const email = ref("");
const collections = ref<AdminCollection[]>([]);
const allMedia = ref<ApiMedia[]>([]);
const filter = ref("");
const loadError = ref("");
// Per-item view counts shown on cards; filled from the Stats tab data when configured.
const viewCounts = ref<Record<string, number>>({});

const visibleMedia = computed(() =>
  filter.value ? allMedia.value.filter((m) => m.collection === filter.value) : allMedia.value,
);

const rereading = ref(false);
// Photos uploaded before auto-fill existed, or after the reader improved. Typed captions and places are kept.
async function rereadAll() {
  const photos = visibleMedia.value.filter((m) => m.type === "image");
  if (!photos.length) return;
  rereading.value = true;
  let done = 0;
  try {
    for (const m of photos) {
      await admin.readMetadata(m.id);
      done++;
    }
    show(`Read ${done} photo${done === 1 ? "" : "s"}`);
  } catch (err) {
    fail(err);
  } finally {
    rereading.value = false;
    await refresh();
  }
}

async function refresh() {
  try {
    const [cols, media] = await Promise.all([admin.collections(), admin.media()]);
    collections.value = cols;
    allMedia.value = media;
    loadError.value = "";
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : String(err);
  }
}

onMounted(async () => {
  admin.me().then((r) => (email.value = r.email)).catch(() => {});
  await refresh();
  admin
    .stats(30)
    .then((s) => {
      if (s.configured && s.media) viewCounts.value = Object.fromEntries(s.media.map((m) => [m.id, m.views]));
    })
    .catch(() => {});
});
</script>

<style scoped>
.tab {
  padding-bottom: 0.5rem;
  color: rgba(255, 255, 255, 0.5);
  border-bottom: 2px solid transparent;
}
.tab--on {
  color: #fff;
  border-bottom-color: #fff;
}
.pill {
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 0.25rem 0.75rem;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.7);
}
.pill--on {
  background: #fff;
  color: #000;
}
.toast {
  position: fixed;
  bottom: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  background: #222;
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 0.6rem 1rem;
  font-size: 0.8rem;
  max-width: 90vw;
}
.toast--error {
  background: #3a1111;
  border-color: rgba(255, 90, 90, 0.5);
}
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.25s;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
}
</style>
