<!-- MediaGallery.vue -->
<template>
  <div class="gallery min-h-screen min-w-full">
    <!-- Loop through the shuffled media array -->
    <template v-for="(mediaGroup, index) in media" :key="index">
      <!-- Render DualMediaSection for pairs of media items -->
      <DualMediaSection
        v-if="Array.isArray(mediaGroup)"
        :mediaItems="mediaGroup"
      />
      <!-- Render MediaSection for individual media items -->
      <MediaSection
        v-else
        :isFullScreen="false"
        :extendBeyondViewport="false"
        :media="mediaGroup"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import MediaSection from "./MediaSection.vue";
import DualMediaSection from "./DualMediaSection.vue";
import { defineProps, ref, onMounted } from "vue";
import { Media } from "../../models/media";

const props = defineProps({
  media: {
    type: Array as () => Media[],
    required: true,
  },
});
</script>

<style>
/* Add any styles for the gallery container here */
.gallery {
  /* Example style */
  display: flex;
  flex-direction: column;
}
</style>
