<!-- MediaDisplay.vue -->
<template>
  <section :class="sectionClasses">
    <template v-if="isFullScreen">
      <!-- Fullscreen media -->
      <img
        v-if="mediaType === 'image'"
        :src="source"
        alt="Media content"
        class="w-screen h-screen object-cover"
      />
      <video
        v-if="mediaType === 'video'"
        :src="source"
        class="w-screen h-screen object-cover"
        autoplay
        loop
        muted
      />
    </template>

    <template v-else-if="isVertical && !extendBeyondViewport">
      <!-- Centered vertical media -->
      <div class="flex justify-center items-center h-screen">
        <img
          v-if="mediaType === 'image'"
          :src="source"
          alt="Media content"
          class="max-w-[85%] h-auto object-contain mx-auto"
        />
        <video
          v-if="mediaType === 'video'"
          :src="source"
          class="max-w-[85%] h-auto object-contain mx-auto"
          autoplay
          loop
          muted
        />
      </div>
    </template>

    <template v-else-if="isVertical && extendBeyondViewport">
      <!-- Extended vertical media -->
      <div :class="verticalMediaClasses">
        <img
          v-if="mediaType === 'image'"
          :src="source"
          alt="Media content"
          class="max-w-[85%] object-contain mx-auto"
        />
      </div>
    </template>

    <template v-else>
      <!-- Centered media with vertical centering -->
      <div class="flex justify-center items-center h-screen">
        <img
          v-if="mediaType === 'image'"
          :src="source"
          alt="Media content"
          class="max-w-[85%] h-auto object-contain mx-auto"
        />
        <video
          v-if="mediaType === 'video'"
          :src="source"
          class="max-w-[85%] h-auto object-contain mx-auto"
          autoplay
          loop
          muted
        />
      </div>
    </template>

    <template v-if="caption">
      <div class="caption">{{ caption }}</div>
    </template>
  </section>
</template>

<script setup lang="">
import { defineProps, computed } from "vue";

const props = defineProps({
  mediaType: {
    type: String,
    required: true,
    validator: (value) => ["image", "video"].includes(value),
  },
  source: {
    type: String,
    required: true,
  },
  caption: String,
  isFullScreen: Boolean,
  isVertical: Boolean,
  extendBeyondViewport: Boolean,
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

<style>
.caption {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: rgba(0, 0, 0, 0.5);
  color: white;
  text-align: center;
  padding: 1rem;
}
</style>
