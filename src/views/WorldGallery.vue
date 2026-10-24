<!-- WorldGallery.vue -->
<template>
  <div class="world-view">
    <WalkableGallery v-if="media.length" :media="media" />
    <div v-else class="empty">{{ loaded ? "No featured photos yet." : "Loading…" }}</div>
    <BottomNav :navItems="navItems" class="fixed-bottom" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, shallowRef } from "vue";
import BottomNav from "../components/ui/BottomNav.vue";
import WalkableGallery from "../components/Gallery/WalkableGallery.vue";
import { useCollections } from "../composables/useCollections";
import { getFeaturedMedia } from "../lib/api";
import { toMedia } from "../lib/mapMedia";
import { Media } from "../models/media";
import { MediaType } from "../types/media";

const { navItems } = useCollections();
const media = shallowRef<Media[]>([]);
const loaded = ref(false);

onMounted(async () => {
  try {
    media.value = (await getFeaturedMedia()).map(toMedia).filter((m) => m.fileType === MediaType.Image);
  } catch (err) {
    console.error("Failed to load featured media", err);
  } finally {
    loaded.value = true;
  }
});
</script>

<style scoped>
.world-view {
  position: relative;
  width: 100%;
  height: 100vh;
  background: #000;
}
.empty {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.5);
  font-family: "Work Sans", sans-serif;
  font-size: 0.875rem;
}
</style>
