<!-- BackgroundImage.vue -->
<template>
  <div class="background flex min-h-screen min-w-full">
    <img
      v-if="mediaType === 'image' && mediaUrl"
      :src="mediaUrl"
      :alt="altText"
      class="object-cover"
      @load="emitMediaLoaded"
      ref="mediaElement"
    />
  </div>
  <slot></slot>
</template>

<script setup lang="ts">
import {  ref } from "vue";
import { useGsapFade } from "../composables/useGsapFade";

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

const mediaElement = ref<HTMLElement | null>(null);

useGsapFade(mediaElement, true);
</script>
