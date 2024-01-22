<!-- ExtendedMedia.vue -->
<template>
  <div class="flex justify-center items-start min-h-screen h-auto">
    <img
      v-if="media.fileType === 'image'"
      :src="media.src"
      alt="Media content"
      class="max-w-[85%] mx-auto object-contain"
      :class="{ 'fade-effect': enableFade }"
    />
  </div>
</template>

<script setup lang="ts">
import { defineProps } from "vue";
import { Media } from "../../models/media";
import { useFade } from "../../composables/useFade";

const props = defineProps({
  media: {
    type: Object as () => Media,
    required: true,
  },
  enableFade: {
    type: Boolean,
    default: false,
  },
});

const { elementRef } = useFade(props.enableFade);
</script>

<style scoped>
.fade-effect {
  opacity: 0;
  transition: opacity 1.2s ease-in-out;
}

.fade-effect.visible {
  opacity: 1;
}
</style>
