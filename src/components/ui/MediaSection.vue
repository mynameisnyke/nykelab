<!-- MediaSection.vue -->
<template>
  <section :class="sectionClasses" ref="mediaSection">
    <!-- Fullscreen media -->
    <div v-if="isFullScreen" class="w-screen h-screen">
      <img
        v-if="mediaType === 'image'"
        :src="source"
        alt="Media content"
        class="object-cover fade-effect"
        :class="{ 'fade-effect': enableFade }"
      />
      <video
        v-if="mediaType === 'video'"
        :src="source"
        class="w-full h-full min-w-full min-h-full object-cover"
        :class="{ 'fade-effect': enableFade }"
        autoplay
        loop
        muted
      />
    </div>

    <!-- Centered vertical media -->
    <div
      v-else-if="isVertical && !extendBeyondViewport"
      class="flex justify-center items-center h-screen"
    >
      <img
        v-if="mediaType === 'image'"
        :src="source"
        alt="Media content"
        class="max-w-[85%] h-auto object-contain mx-auto fade-effect"
        :class="{ 'fade-effect': enableFade }"
      />
      <video
        v-if="mediaType === 'video'"
        :src="source"
        class="max-w-[85%] h-auto object-contain mx-auto fade-effect"
        :class="{ 'fade-effect': enableFade }"
        autoplay
        loop
        muted
      />
    </div>

    <!-- Extended vertical media -->
    <div
      v-else-if="isVertical && extendBeyondViewport"
      :class="verticalMediaClasses"
    >
      <img
        v-if="mediaType === 'image'"
        :src="source"
        alt="Media content"
        class="max-w-[85%] object-contain mx-auto fade-effect"
        :class="{ 'fade-effect': enableFade }"
      />
    </div>

    <!-- Centered media with vertical centering -->
    <div v-else class="flex justify-center items-center h-screen">
      <img
        v-if="mediaType === 'image'"
        :src="source"
        alt="Media content"
        class="max-w-[85%] h-auto object-contain mx-auto fade-effect"
        :class="{ 'fade-effect': enableFade }"
      />
      <video
        v-if="mediaType === 'video'"
        :src="source"
        class="max-w-[85%] h-auto object-contain mx-auto fade-effect"
        :class="{ 'fade-effect': enableFade }"
        autoplay
        loop
        muted
      />
    </div>
    <!-- Caption -->
    <div v-if="caption" class="caption">{{ caption }}</div>
  </section>
</template>

<script setup lang="ts">
import { defineProps, computed, ref, onMounted, onUnmounted } from "vue";

const props = defineProps({
  mediaType: String,
  source: String,
  enableFade: Boolean,
  caption: String,
  isFullScreen: Boolean,
  isVertical: Boolean,
  extendBeyondViewport: Boolean,
});

const mediaSection = ref(null);
let observer;

const onMediaLoad = () => {
  if (props.enableFade) {
    setupIntersectionObserver();
  } else {
    // If fading is not enabled, show the media immediately
    const mediaElements = mediaSection.value.querySelectorAll(".media-class");
    mediaElements.forEach((el) => el.classList.add("visible"));
  }
};

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
  "overflow-hidden": !props.isFullScreen && !props.extendBeyondViewport,
  "h-screen":
    props.isFullScreen || (!props.isVertical && !props.extendBeyondViewport),
  "min-h-screen":
    !props.isFullScreen && (props.isVertical || props.extendBeyondViewport),
}));

const verticalMediaClasses = computed(() => ({
  flex: props.extendBeyondViewport,
  "justify-center": props.extendBeyondViewport,
  "items-start": props.extendBeyondViewport,
  "min-h-screen": props.extendBeyondViewport,
  "h-auto": !props.extendBeyondViewport,
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
