<template>
  <transition name="fade">
    <BottomNav :class="footerClass" v-if="footerVisible" class="fixed-bottom" />
  </transition>
  <media-section
    :mediaType="grand_teton[0].type"
    :isFullScreen="true"
    :source="grand_teton[0].src"
  >
    <template> <CaptionDisplay caption="blah" /></template>
  </media-section>
  <media-section
    :mediaType="grand_teton[1].type"
    :source="grand_teton[3].src"
    :isFullScreen="false"
    class="mb-3"
  />
  <media-section
    :mediaType="grand_teton[1].type"
    :source="grand_teton[5].src"
    :isFullScreen="false"
    :isVertical="true"
    :extendBeyondViewport="true"
  />
  <DualMediaSection :mediaItems="tetonsPortrait" />
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import BottomNav from "../components/ui/BottomNav.vue";
import { grand_teton, tetonsPortrait } from "../../public/data";
import CaptionDisplay from "../components/ui/CaptionDisplay.vue";
import DualMediaSection from "../components/ui/DualMediaSection.vue";

const footerVisible = ref(true); // this will control the visibility

const headerVisible = ref(true); // this will control the header visibility

const headerClass = computed(() => {
  return headerVisible.value ? "" : "hidden";
});

const toggleVisibility = (isPassed: boolean) => {
  footerVisible.value = !isPassed;
  headerVisible.value = isPassed;
};

// Compute the class for the footer
const footerClass = computed(() => {
  return footerVisible.value ? "fixed-bottom" : "hidden";
});
</script>

<style>
/* Initial state of the element entering */
.fade-enter-from,
.fade-leave-active {
  opacity: 1;
}

/* End state for the element that's leaving */
.fade-leave-to,
.fade-enter-active {
  opacity: 0;
}

/* Apply a transition to both enter/leave */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s;
}
</style>
