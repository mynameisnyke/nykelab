<!-- Centered.vue -->
<template>
  <div class="flex justify-center items-center h-screen">
    <template v-if="media.fileType === 'image'">
      <img
        :src="media.src"
        :alt="media.name"
        :class="[mediaClass, { 'fade-effect': enableFade }]"
        ref="mediaElement"
      />
    </template>
    <template v-else-if="media.fileType === 'video'">
      <video
        :src="media.src"
        class="max-w-[85%] md:max-w-[600px] h-auto object-contain mx-auto"
        autoplay
        loop
        muted
        :class="[mediaClass, { 'fade-effect': enableFade }]"
        ref="mediaElement"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { defineProps, computed } from "vue";
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

const { elementRef: mediaElement } = useFade(props.enableFade);

// Compute the class based on media orientation
const mediaClass = computed(() => {
  return props.media.isVertical
    ? "max-w-[85%] md:max-w-[600px] h-auto object-contain mx-auto"
    : "max-w-[85%] md:max-w-[1230px] h-auto object-contain mx-auto";
});
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
