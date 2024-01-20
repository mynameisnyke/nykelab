<template>
  <div class="w-full pl-2.5 pr-4 py-2.5 justify-start items-start gap-3 flex">
    <div
      class="opacity-90 text-white font-bold font-['Arial'] uppercase leading-none"
    >
      {{ number }}
    </div>
    <div
      :class="textSizeClass"
      class="opacity-60 text-white font-bold font-['Arial'] uppercase leading-none"
    >
      {{ label }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

const props = defineProps({
  number: {
    type: [String, Number],
    required: true,
  },
  label: {
    type: String,
    required: true,
  },
  textSize: {
    type: String,
    default: "base",
  },
});

const textSizeClass = ref(`text-${props.textSize}`);
</script>
