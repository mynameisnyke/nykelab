<template>
  <transition name="fade">
    <BottomNav :class="footerClass" v-if="footerVisible" class="fixed-bottom" />
  </transition>
  <ScrollableBody @section-passed="toggleVisibility" />
  <!-- <MediaRow :media="tetons" /> -->
</template>

<script setup lang="ts">
import { useFooterVisibility } from "../composables/useFooterVisibility";
import BottomNav from "../components/ui/BottomNav.vue";
import ScrollableBody from "../components/ScrollableBody.vue";



const { footerVisible, toggleVisibility, footerClass } = useFooterVisibility();
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
