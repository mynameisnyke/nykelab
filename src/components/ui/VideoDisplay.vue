<!-- VideoDisplay.vue -->
<template>
  <video class="media-video" autoplay loop muted>
    <source :src="source" type="video/mp4" />
    Your browser does not support the video tag.
  </video>
</template>

<script setup lang="ts">
import { defineProps } from "vue";

const props = defineProps({
  source: {
    type: String,
    required: true,
  },
});
</script>

<style scoped>
.media-video {
  width: 100%;
  height: auto;
  object-fit: cover;
}
</style>
