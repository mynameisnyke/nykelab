<!-- MediaDisplay.vue -->
<template>
  <div
    :class="[
      { 'cursor-pointer': canExpand },
      computedMaxWidthClass,
      computedMaxHeightClass,
    ]"
    @click="toggleExpand"
    ref="mediaElement"
  >
    <template v-if="media.fileType === MediaType.Image">
      <img
        :src="media.src"
        :class="[computedObjectFitClass, `w-full h-full`]"
        :alt="media.name"
      />
    </template>
    <template v-else-if="media.fileType === MediaType.Video">
      <video
        :src="media.src"
        :class="[computedObjectFitClass, `w-full h-full`]"
        autoplay
        loop
        muted
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, inject, computed } from "vue";
import { Media } from "../../models/media";
import { MediaType } from "@/types/media";
import { useGsapFade } from "../../composables/useGsapFade";
import { useSrcSetter } from "../../composables/useSrcSetter";

// Prop setup
const props = defineProps({
  // The media object for this display
  media: {
    type: Object as () => Media,
    required: true,
  },
  // Toggle GSAP fade in animation
  enableFade: {
    type: Boolean,
    default: false,
  },
  // Toggle the ability to expand on click
  canExpand: {
    type: Boolean,
    default: false,
  },
  // What type of section will this media be rendered in
  width: {
    type: String,
    default: "w-auto",
  },
  // What type of section will this media be rendered in
  maxHeight: {
    type: Number,
    default: null,
  },
  // What type of section will this media be rendered in
  objectFit: {
    type: String,
    default: "cover",
  },
  isFullscreen: {
    type: Boolean,
    default: false,
  },
});

// Check configuration props
const computedMaxWidthClass = computed(() => {
  // Check if fullscreen
  if (props.isFullscreen) {
    return `w-full`;
  }
  return props.width ? props.width : `w-auto`;
});
const computedMaxHeightClass = computed(() => {
  // Check if fullscreen
  if (props.isFullscreen) {
    return `h-full`;
  }
  return props.maxHeight ? `h-[${props.maxHeight}px]` : "h-auto";
});
const computedObjectFitClass = computed(() => {
  switch (props.objectFit) {
    case "cover":
      return "object-cover";
    case "contain":
      return "object-contain";
    case "fill":
      return "object-fill";
    case "none":
      return "object-none";
    case "scale-down":
      return "object-scale-down";
    default:
      return "object-cover";
  }
});

// Inject device type
const mobile: boolean = inject("mobile")!;

// Determin appropriate src material by device type
const source = useSrcSetter(props.media, mobile);

// Setup the expanded logic
const state = reactive({
  isExpanded: false,
});

const toggleExpand = () => {
  if (props.canExpand) {
    state.isExpanded = !state.isExpanded;
  }
};

// Setup the fading logic
const mediaElement = ref<HTMLElement | null>(null);
useGsapFade(mediaElement, props.enableFade);

console.log(props.media);
</script>

<style scoped>
.w-full {
  width: 100%;
}

.h-full {
  height: 100%;
}
</style>
