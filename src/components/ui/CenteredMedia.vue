<!-- CenteredMedia.vue -->
<template>
  <section
    class="min-h-screen w-full flex flex-col justify-center items-center gap-5 mb-20"
  >
    <MediaDisplay
      id="2"
      :media="media"
      :enableFade="enableFade"
      width="w-[85%] md:w-[600px] lg:md:w-[1230px]"
    />
    <MediaCaption :media="media" :enableFade="enableFade" />
  </section>
</template>

<script setup lang="ts">
import {  ref, inject } from "vue";
import { Media } from "../../models/media";
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
  objectFit: {
    type: String,
    default: "cover",
  },
});

// Inject device type
const mobile: boolean = inject("mobile")!;

const mediaElement = ref<HTMLElement | null>(null);
</script>
