<!-- BackgroundImage.vue -->
<template>
  <div class="background flex min-h-screen min-w-full">
    <img
      v-if="mediaType === 'image' && mediaUrl"
      :src="mediaUrl"
      :alt="altText"
      class="background-media object-cover"
      :class="{ loaded: imageLoaded }"
      @load="emitMediaLoaded"
    />
  </div>
  <slot></slot>
</template>

<script setup lang="ts">
import { defineProps, defineEmits, ref } from "vue";

const props = defineProps({
  mediaType: String,
  mediaUrl: String,
  altText: String,
});

const emit = defineEmits(["media-loaded"]);
const imageLoaded = ref(false); // Initialize as not visible

const emitMediaLoaded = () => {
  imageLoaded.value = true; // Make media visible when loaded
  emit("media-loaded");
};
</script>

<style>
.background-media {
  transition: opacity 1s ease-in-out;
  opacity: 0;
}

.background-media.loaded {
  opacity: 1;
}
</style>
