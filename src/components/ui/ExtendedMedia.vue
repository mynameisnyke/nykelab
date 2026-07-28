<!-- ExtendedMedia.vue -->
<template>
  <div class="flex justify-center min-h-screen h-auto">
    <img
      v-if="media.fileType === 'image'"
      :src="source.updatedSrc.value"
      alt="Media content"
      class="max-w-[85%] object-contain"
      ref="mediaElement"
    />
  </div>
</template>

<script setup lang="ts">
import {  ref, inject } from "vue";
import { Media } from "../../models/media";
import { useGsapFade } from "../../composables/useGsapFade";
import { useSrcSetter } from "../../composables/useSrcSetter";

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

// Determin appropriate src material by device type
const source = useSrcSetter(props.media, mobile);

const mediaElement = ref<HTMLElement | null>(null);

useGsapFade(mediaElement, props.enableFade);
</script>
