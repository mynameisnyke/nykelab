<!-- DualMediaSectin.vue -->
<template>
  <section class="dual-media-section">
    <div class="media-wrapper max-w-[85%]">
      <MediaSection
        v-for="(mediaItem, index) in mediaItems"
        :key="index"
        :mediaType="mediaItem.mediaType"
        :source="mediaItem.src"
        :isFullScreen="mediaItem.fullScreen"
        :caption="mediaItem.caption"
        :isVertical="true"
        :enableFade="true"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { defineProps } from "vue";
import MediaSection from "./MediaSection.vue";

const props = defineProps({
  mediaItems: {
    type: Array,
    required: true,
    default: () => [],
  },
});
</script>

<style>
.dual-media-section {
  display: flex;
  height: 100vh; /* Set the height to viewport height */
  overflow: hidden;
}

.media-wrapper {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px; /* Adjust the gap between items */
  width: 100%; /* Ensure the wrapper takes full width */
  margin: 0 auto; /* Center the wrapper if it's not full width */
}

@media (max-width: 768px) {
  /* Adjust based on your responsive design needs */
  .media-wrapper {
    grid-template-columns: 1fr; /* Stack images on smaller screens */
  }
}
</style>
