Zdcv <!-- MediaSection.vue -->
<template>
  <section class="fullscreen-media">
    <!-- Fullscreen media -->
    <template v-if="layout == LayoutOptions.fullscreen">
      <MediaDisplay :media="media" :enableFade="true" :layout="layout" />
      <!-- Caption -->
      <template v-if="media?.caption">
        <MediaCaption :media="media" />
      </template>
    </template>

    <!-- Extended vertical media -->
    <template v-if="layout == LayoutOptions.extended" :layout="layout">
      <MediaDisplay :media="media" :enableFade="true" />
      <template v-if="media?.caption">
        <MediaCaption :media="media" />
      </template>
    </template>

    <!-- Centered media -->
    <template v-if="layout == LayoutOptions.centered" :layout="layout">
      <MediaDisplay :media="media" :enableFade="true" />
      <template v-if="media?.caption">
        <MediaCaption :media="media" />
      </template>
    </template>
  </section>
</template>

<script setup lang="ts">
import { Media } from "../../models/media";
import MediaCaption from "./MediaCaption.vue";
import MediaDisplay from "./MediaDisplay.vue";

// Define the enum for layout options
const LayoutOptions = {
  centered: "centered",
  extended: "extended",
  fullscreen: "fullscreen",
} as const;

type LayoutOption = (typeof LayoutOptions)[keyof typeof LayoutOptions];

const props = defineProps({
  media: {
    type: Object as () => Media,
    required: true,
  },
  layout: {
    type: String as () => LayoutOption,
    default: "centered",
  },
});
</script>

<style scoped>
.fullscreen-media {
  width: 100%;
  height: 100vh;
  object-fit: cover;
}
</style>
