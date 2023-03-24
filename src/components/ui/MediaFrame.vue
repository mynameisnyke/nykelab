<template>
  <div
    :id="props.media.id"
    class="flex flex-col gap-2"
    :class="{
      'col-span-4 lg:col-start-5': isPortrait,
      'col-span-8 2xl:col-span-6 lg:col-start-3 2xl:col-start-4': isLandscpe,
    }"
  >
    <img
      :src="props.media.src"
      :alt="props.media.id"
      v-if="!isVideo"
      class="object-cover"
      :class="{ 'max-h-[900px]': isPortrait }"
    />
    <video v-else src="" :id="props.media.id" />
  </div>
</template>

<script setup lang="ts">
import { PropType, onBeforeMount, ref } from "vue";
import { Media } from "../../types/media";

const props = defineProps({
  media: {
    type: Object as PropType<Media>,
    required: true,
  },
});

// Condtional rendereing values
let isPortrait = ref(false);
let isLandscpe = ref(false);
let isVideo = ref(false);

// Before mounted lifecycel we want to check the content type and orientation
onBeforeMount(() => {
  console.log("hello", props.media.orientation);
  // Check orientation
  switch (props.media.orientation) {
    case "landscape":
      isLandscpe.value = true;
      break;
    default:
      isPortrait.value = true;
      break;
  }

  // Check content type
  switch (props.media.fileType.split("/")[0]) {
    case "video":
      isVideo.value = true;
      break;
    default:
      break;
  }
});
</script>

<style></style>
