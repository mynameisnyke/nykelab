<!-- MediaCaption.vue -->
<template>
  <div class="flex flex-col items-center gap-1" :class="maxWidthClass">
    <div
      v-html="formattedText"
      :class="[
        textColorClass,
        fontSizeClass,
        fontLeading,
        fontFamily,
        textAlign,
      ]"
      ref="captionElement"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { Media } from "../../models/media";
import { useFormattedText } from "../../composables/useFormattedText";
import { useGsapFade } from "../../composables/useGsapFade";

const props = defineProps({
  media: Object as () => Media,
  maxWidth: {
    type: String,
    default: "w-full",
  },
  textColor: {
    type: String,
    default: "text-gray-400",
  },
  fontSize: {
    type: String,
    default: "normal",
  },
  fontLeading: {
    type: String,
    default: "normal",
  },
  fontFamily: {
    type: String,
    default: "font-san",
  },
  textAlign: {
    type: String,
    default: "text-center",
  },
  enableFade: {
    type: Boolean,
    default: false,
  },
});

// Compute the Tailwind CSS class based on the maxWidth prop
const maxWidthClass = computed(() => {
  return props.maxWidth ? props.maxWidth : `w-full`;
});

// Compute the color based off props
const textColorClass = computed(() => {
  return props.textColor ? props.textColor : `text-gray-400`;
});
// Compute the color based off props
const fontSizeClass = computed(() => {
  return props.fontSize ? `font-${props.fontSize}` : `font-normal`;
});
// Compute the color based off props
const fontLeading = computed(() => {
  return props.fontLeading ? `leading-${props.fontLeading}` : `leading-normal`;
});
// Compute the color based off props
const fontFamily = computed(() => {
  return props.fontFamily ? `${props.fontFamily}` : `font-sans`;
});
// Compute the color based off props
const textAlign = computed(() => {
  return props.textAlign ? props.textAlign : `text-center`;
});

// Let's format the text, to catch line breaks
const formattedText = computed(() => {
  return props.media?.caption
    ? useFormattedText(props.media?.caption).formattedText.value
    : "";
});

// Setup the fading logic
const captionElement = ref<HTMLElement | null>(null);
useGsapFade(captionElement, props.enableFade);
</script>

<style scoped></style>
