<template>
  <div @scroll="handleScroll" class="scrollable-body">
    <MediaSection
      v-for="(media, index) in arizona"
      :key="index"
      :mediaType="media.type"
      :src="media.src"
      :displayStyle="media.displayStyle"
      :caption="media.caption"
      :orientation="media.orientation"
    />
  </div>
</template>

<script setup lang="ts">
import { ref,  } from "vue";
import MediaSection from "@/components/ui/MediaSection.vue";
import MediaRow from "@/components/ui/MediaRow.vue";
import { Media } from "../types/media";
import { arizona } from "../../public/data";

const emit = defineEmits(["section-passed"]);

const scrollY = ref(0);

const handleScroll = (event: Event) => {
  const target = event.target as HTMLElement;
  scrollY.value = target.scrollTop;

  // Ensure there's a first child and it's an HTMLElement
  if (target.children[0] && (target.children[0] as HTMLElement).clientHeight) {
    const firstSectionHeight = (target.children[0] as HTMLElement).clientHeight;

    // Check if scrolled distance is greater than the height of the first section
    if (scrollY.value > firstSectionHeight / 10) {
      emit("section-passed", true);
    } else {
      emit("section-passed", false);
    }
  }
};
</script>

<style scoped>
.scrollable-body {
  overflow-y: auto;
  height: 100vh;
}
</style>
