<!-- DualMediaSectin.vue -->
<template>
  <section class="flex min-h-screen overflow-hidden">
    <div class="media-wrapper max-w-[1285px]">
      <MediaDisplay
        v-for="(mediaItem, index) in mediaItems"
        :key="index"
        :media="mediaItem"
        :enableFade="enableFade"
        objectFit="contain"
        mode="dual"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import MediaDisplay from "./MediaDisplay.vue";
import { Media } from "../../models/media";

const props = defineProps({
  mediaItems: {
    type: Array as () => Media[],
    required: true,
    default: () => [],
  },
  enableFade: {
    type: Boolean,
    default: false,
  },
});
</script>

<style>
.media-wrapper {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px; /* Adjust the gap between items */
  margin: 0 auto; /* Center the wrapper if it's not full width */
}

@media (max-width: 768px) {
  /* Adjust based on your responsive design needs */
  .media-wrapper {
    grid-template-columns: 1fr; /* Stack images on smaller screens */
  }
}
</style>
