<template>
  <div
    :class="{ 'centered-content-visible': isVisible }"
    class="opacity-0 absolute top-0 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center justify-center gap-5 w-[390px] md:w-[531px] h-full p-1 md:p-0 px-4 md:px-0 sm:pt-2.5 sm:gap-[19.8px] sm:items-start"
  >
    <slot></slot>
    <!-- Slot for nested content -->
  </div>
</template>

<script setup lang="ts">
import { defineProps } from "vue";

const props = defineProps({
  isVisible: Boolean,
});
</script>

<style scoped>
.centered-content-visible {
  transition: opacity 1.2s ease-in-out;
  opacity: 1;
}
</style>
