<template>
  <BottomNav :class="footerClass" v-if="footerVisible" class="fixed-bottom" />
  <CenteredContent :isVisible="true">
    <IcicleChart :data="mediaData" :enableFade="true" :size="chartSize" />
  </CenteredContent>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useFooterVisibility } from "../composables/useFooterVisibility";
import BottomNav from "../components/ui/BottomNav.vue";
import IcicleChart from "../components/IcicleChart.vue";
import CenteredContent from "../components/ui/CenteredContent.vue";
const mediaData = {
  name: "Media",
  children: [
    {
      name: "Images",
      children: [
        {
          name: "Nature",
          children: [
            { name: "Forest", src: "http://example.com/forest", size: 5 },
            { name: "Mountain", src: "http://example.com/mountain", size: 1 },
          ],
        },
        {
          name: "City",
          children: [
            { name: "Buildings", src: "http://example.com/buildings", size: 1 },
            { name: "Streets", src: "http://example.com/streets", size: 1 },
          ],
        },
      ],
    },
    {
      name: "Videos",
      children: [
        {
          name: "Dogs",
          src: "http://example.com/documentaries",
          size: 1,
        },
        { name: "Movies", src: "http://example.com/movies", size: 1 },
      ],
    },
  ],
};
const chartSize = computed(() => (window.innerWidth < 640 ? 350 : 500));
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
