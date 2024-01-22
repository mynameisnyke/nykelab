<!-- FullScreenMedia.vue -->
<template>
  <div class="min-h-screen w-full">
    <template v-if="media.fileType === 'image'">
      <img
        :src="media.src"
        alt="Media content"
        class="object-cover"
        :class="{ 'fade-effect': enableFade }"
        ref="mediaElement"
      />
    </template>
    <template v-else-if="media.fileType === 'video'">
      <video
        :src="media.src"
        class="object-cover h-screen w-full"
        autoplay
        loop
        muted
        :class="{ 'fade-effect': enableFade }"
        ref="mediaElement"
      />
    </template>
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

console.log(props.enableFade);

const { elementRef: mediaElement } = useFade(props.enableFade);
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
