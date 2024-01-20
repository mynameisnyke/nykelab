<template>
  <img :src="source" :alt="altText" class="media-image" />
</template>

<script setup lang="ts">
import { defineProps } from "vue";

const props = defineProps({
  source: {
    type: String,
    required: true,
  },
  altText: String,
});
</script>

<style scoped>
.media-image {
  width: 100%;
  height: auto;
  object-fit: cover;
}
</style>
