<template>
  <div
    :id="props.media.id + '-mediaframe'"
    class="flex flex-col gap-1 opacity-0"
    :class="{
      'col-span-4 lg:col-start-5': isPortrait, // For positioning on a 12 col grid
      'col-span-6 col-start-4': isLandscpe, // For positioning on a 12 col grid
      'opacity-100': showImage,
      'transition-opacity ease-in-out duration-[1500ms]': fadeIn,
    }"
    @click="handleClick"
  >
    <img
      :id="props.media.id + '-img'"
      :src="srcImage"
      :alt="props.media.id"
      v-if="!isVideo"
      class="object-cover"
      :class="{ 'max-h-[900px]': isPortrait }"
    />
    <video
      v-if="isVideo"
      autoplay
      muted
      :src="srcImage"
      :id="props.media.id + '-video'"
      preload="auto"
      playsinline
      loop
    />
    <!-- Label -->
    <div
      :id="props.media.id + '-label'"
      class="flex flex-col"
      v-if="props.media.name"
    >
      <span
        class="lg:text-2xl lg:leading-6 tracking-tight font-work-sans font-semibold text-gray-900 dark:text-gray-50"
      >
        {{ props.media.name }}
      </span>
      <span
        class="lg:text-xl lg:leading-6 tracking-tight font-work-sans font-normal text-gray-900 dark:text-gray-50"
        >{{ prettyDate }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { PropType, onBeforeMount, onMounted, ref, computed } from "vue";
import { Media } from "../../types/media";
import { formatDate } from "@vueuse/core";

const props = defineProps({
  media: {
    type: Object as PropType<Media>,
    required: true,
  },
  fadeIn: {
    type: Boolean,
    default: false,
  },
});

// Condtional rendereing values
const showImage = ref(false);
const isPortrait = ref(false);
const isLandscpe = ref(false);
const isVideo = ref(false);
const isVisible = ref(false);
const prettyDateCreated = ref(""); // Should consider making this a computerProperty

const srcImage = computed(() => {
  return isVisible.value ? props.media.src : "";
});

// Formats date from media object into pretty string
const prettyDate = computed(() => {
  var timestamp = Date.parse(props.media.dateCreated!);
  const d = new Date(timestamp);
  return (prettyDateCreated.value = formatDate(d, "YYYY"));
});

// Lazy loading
onMounted(() => {
  // Build our query selector for the observer
  let selector = "";
  switch (props.media.fileType.split("/")[0]) {
    case "video":
      selector = `#${props.media.id}-video`;
      break;
    default:
      selector = `#${props.media.id}-img`;
      break;
  }
  const ele = document.querySelector(selector);

  // Init and observe
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting && entry.intersectionRatio === 1) {
        console.log(`#${props.media.id}-mediaframe`);
        console.log(entry.intersectionRatio, entry.isIntersecting);
        isVisible.value = true;
        showImage.value = true;
        observer.unobserve(entry.target);
      }
    });
  });

  observer.observe(ele!);
});

// Before mounted lifecycle we want to check the content type and orientation
onBeforeMount(() => {
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
      showImage.value = true;
      break;
    default:
      break;
  }
});

// Define the emits for this component
// Imageclick is listened to by our `carousel` component, to handle fade in transitions
const emit = defineEmits<{
  (e: "image-click", value: string): void;
}>();
// ...
const handleClick = () => {
  emit("image-click", props.media.id);
};
</script>

<style></style>
