<template>
  <div class="flex flex-col items-center w-[1230px] h-[818.80px] relative">
    <video
      v-if="fileType === 'video'"
      class="w-full h-full object-cover"
      autoplay
      loop
      muted
    >
      <source :src="src" type="video/mp4" />
      Your browser does not support the video tag.
    </video>

    <img
      v-else-if="fileType === 'image'"
      :src="src"
      class="w-full h-full object-cover"
      :style="style"
    />
    <div
      class="text-neutral-400 text-base font-normal font-['Arial'] mt-5 text-center"
    >
      P6W3+P2 Alta, Wyoming
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, defineProps } from "vue";

const props = defineProps({
  fileType: {
    type: String,
    required: true,
  },
  src: {
    type: String,
    required: true,
    default: "image",
  },
  style: Object, // Add this line
});
</script>

<!-- ... rest of your code ... -->
