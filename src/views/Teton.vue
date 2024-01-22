<template>
  <transition name="fade">
    <BottomNav :class="footerClass" v-if="footerVisible" class="fixed-bottom" />
  </transition>
  <!-- Full -->
  <MediaSection :media="media" :enableFade="true" :isFullScreen="true" />
  <!-- Extended -->
  <MediaSection :media="centered_media" :enableFade="true" />
  <!-- Centered -->
  <MediaSection :media="extended_media" :enableFade="true" />

  <!-- <DualMediaSection :mediaItems="tetonsPortrait" /> -->
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import BottomNav from "../components/ui/BottomNav.vue";
import { tetonsPortrait, teton_media } from "../../public/data";
import MediaSection from "../components/ui/MediaSection.vue";
import DualMediaSection from "../components/ui/DualMediaSection.vue";
import { Media } from "../models/media";

const media = new Media(teton_media[0]);
const centered_media = new Media(teton_media[3]);
const extended_media = new Media(teton_media[2]);

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
