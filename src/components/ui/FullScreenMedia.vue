<!-- FullScreenMedia.vue -->
<template>
  <section class="fullscreen-media">
    <MediaDisplay
      id="1"
      :media="media"
      :enableFade="enableFade"
      :isFullscreen="true"
    />
    <template v-if="!mobile">
      <MediaCaption
        class="absolute right-8 bottom-6"
        :media="media"
        :enableFade="enableFade"
        maxWidth="max-w-[600px]"
        textAlign="text-right"
      />
    </template>
  </section>
</template>

<script setup lang="ts">
import {  ref, inject } from "vue";
import { Media } from "../../models/media";
import { useSrcSetter } from "../../composables/useSrcSetter";
import MediaDisplay from "./MediaDisplay.vue";
import MediaCaption from "./MediaCaption.vue";

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

// Inject device type
const mobile: boolean = inject("mobile")!;

console.log(mobile);

// Determin appropriate src material by device type
const source = useSrcSetter(props.media, mobile);
</script>

<style scoped>
.fullscreen-media {
  height: 100vh; /* Ensure the section takes up the full height of the viewport */
  min-height: 100vh; /* Ensure the section takes up the full height of the viewport */
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  position: relative;
}
</style>
