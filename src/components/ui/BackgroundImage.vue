<template>
  <div
    v-if="fileType === 'image'"
    :style="backgroundImageStyle"
    class="absolute top-0 left-0 w-full h-screen bg-no-repeat bg-center bg-cover"
  ></div>
  <video
    v-else-if="fileType === 'video'"
    class="absolute top-0 left-0 w-full h-screen"
    autoplay
    muted
    loop
  >
    <source :src="fileUrl" type="video/mp4" />
    Your browser does not support the video tag.
  </video>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";

const props = defineProps({
  fileType: {
    type: String,
    required: true,
    default: "image",
  },
  fileUrl: {
    type: String,
    default: "https://storage.googleapis.com/nykelab-dev/DSC00459.jpg",
  },
});

const backgroundImageStyle = computed(() => {
  return props.fileType === "image"
    ? { backgroundImage: `url('${props.fileUrl}')` }
    : {};
});
</script>
