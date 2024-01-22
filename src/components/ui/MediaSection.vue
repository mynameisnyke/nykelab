<!-- MediaSection.vue -->
<template>
  <section :class="sectionClasses" ref="mediaSection" class="md:mb-40 2xl:mb-0">
    <!-- Fullscreen media -->
    <template v-if="isFullScreen">
      <FullScreenMedia :media="media" :enableFade="enableFade" />
    </template>

    <!-- Centered media -->
    <template v-if="!isFullScreen && !isExtended">
      <CenteredMedia :media="media" :enableFade="enableFade" />
    </template>

    <!-- Extended vertical media -->
    <template v-if="isExtended">
      <ExtendedMedia :media="media" :enableFade="enableFade" />
    </template>
    <!-- Caption -->
    <div v-if="caption" class="caption">{{ caption }}</div>
  </section>
</template>

<script setup lang="ts">
import { defineProps, computed, ref, onMounted, onUnmounted } from "vue";
import FullScreenMedia from "../ui/FullScreenMedia.vue";
import ExtendedMedia from "../ui/ExtendedMedia.vue";
import CenteredMedia from "./CenteredMedia.vue";

const props = defineProps({
  media: Object,
  enableFade: Boolean,
  caption: String,
  isFullScreen: {
    type: Boolean,
    default: false,
  },
  isVertical: {
    type: Boolean,
    default: false,
  },
  extendBeyondViewport: Boolean,
  isExtended: {
    type: Boolean,
    default: false,
  },
});

const mediaSection = ref(null);
let observer;

// const onMediaLoad = () => {
//   if (props.enableFade) {
//     setupIntersectionObserver();
//   } else {
//     // If fading is not enabled, show the media immediately
//     const mediaElements = mediaSection.value.querySelectorAll(".media-class");
//     mediaElements.forEach((el) => el.classList.add("visible"));
//   }
// };

const setupIntersectionObserver = () => {
  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
        } else {
          entry.target.classList.remove("visible");
        }
      });
    },
    { threshold: 0.1 }
  );

  const mediaElements = mediaSection.value.querySelectorAll(".fade-effect");
  mediaElements.forEach((el) => observer.observe(el));
};

onMounted(() => {
  if (props.enableFade) {
    setupIntersectionObserver();
  }
});

onUnmounted(() => {
  if (observer) {
    observer.disconnect();
  }
});

const sectionClasses = computed(() => ({
  relative: true,
  "overflow-hidden": !props.isFullScreen || !props.extendBeyondViewport,
  "h-screen": props.isFullScreen && !props.extendBeyondViewport,
  "min-h-screen": !props.isFullScreen && (props.isVertical || props.isExtended),
}));
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
