<!-- CollectionView.vue — one page per collection, built from the API -->
<template>
  <BottomNav class="fixed-bottom" :navItems="navItems" />

  <div v-if="status === 'loading'" class="status-screen">Loading…</div>
  <div v-else-if="status === 'error'" class="status-screen">
    Couldn't load this collection. Try refreshing.
  </div>
  <div v-else-if="status === 'missing'" class="status-screen">Nothing here.</div>
  <div v-else-if="!items.length" class="status-screen">Nothing here yet.</div>

  <template v-else>
    <template v-for="(m, i) in items" :key="m.id">
      <FullScreenMedia v-if="layoutFor(m, i) === 'full'" :media="m" :enableFade="true" class="mb-20" />
      <CenteredMedia
        v-else
        :media="m"
        :enableFade="true"
        :width="m.orientation === 'portrait' ? 'w-[70%] md:w-[420px]' : undefined"
      />
    </template>
  </template>
</template>

<script setup lang="ts">
import { ref, shallowRef, watch } from "vue";
import { useRoute } from "vue-router";
import BottomNav from "../components/ui/BottomNav.vue";
import FullScreenMedia from "../components/ui/FullScreenMedia.vue";
import CenteredMedia from "../components/ui/CenteredMedia.vue";
import { ApiError, getCollectionMedia } from "../lib/api";
import { toMedia } from "../lib/mapMedia";
import { Media } from "../models/media";
import { useCollections } from "../composables/useCollections";

const route = useRoute();
const { navItems } = useCollections();

const items = shallowRef<Media[]>([]);
const status = ref<"loading" | "ready" | "error" | "missing">("loading");

// Rhythm: open fullscreen, then every third landscape item goes fullscreen.
// Portrait shots are always centered so they aren't blown up to screen width.
function layoutFor(m: Media, i: number) {
  if (m.orientation === "portrait") return "centered";
  return i % 3 === 0 ? "full" : "centered";
}

watch(
  () => route.params.slug as string,
  async (slug) => {
    status.value = "loading";
    items.value = [];
    try {
      const media = await getCollectionMedia(slug);
      items.value = media.map(toMedia);
      status.value = "ready";
    } catch (err) {
      status.value = err instanceof ApiError && err.status === 400 ? "missing" : "error";
    }
  },
  { immediate: true },
);
</script>

<style scoped>
.status-screen {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.5);
  font-family: "Work Sans", sans-serif;
  font-size: 0.875rem;
  letter-spacing: 0.04em;
}
</style>
