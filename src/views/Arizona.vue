<template>
  <transition name="fade">
    <BottomNav :class="footerClass" v-if="footerVisible" class="fixed-bottom" />
  </transition>
  <media-section
    @section-passed="toggleVisibility"
    :mediaType="arizona[0].type"
    :src="arizona[0].src"
    :displayStyle="arizona[0].displayStyle"
    :caption="arizona[0].caption"
    :orientation="arizona[0].orientation"
    :showOverlay="true"
  />
  <media-section
    :mediaType="arizona[1].type"
    :src="arizona[1].src"
    :displayStyle="arizona[1].displayStyle"
    :caption="arizona[1].caption"
    :orientation="arizona[1].orientation"
  />
  <media-section
    :mediaType="arizona[2].type"
    :src="arizona[2].src"
    :displayStyle="arizona[2].displayStyle"
    :caption="arizona[2].caption"
    :orientation="arizona[2].orientation"
  />
  <media-section
    :mediaType="arizona[3].type"
    :src="arizona[3].src"
    :displayStyle="arizona[3].displayStyle"
    :caption="arizona[3].caption"
    :orientation="arizona[3].orientation"
  />
  <media-section
    :mediaType="arizona[4].type"
    :src="arizona[4].src"
    :displayStyle="arizona[4].displayStyle"
    :caption="arizona[4].caption"
    :orientation="arizona[4].orientation"
  />
  <media-section
    :mediaType="arizona[5].type"
    :src="arizona[5].src"
    :displayStyle="arizona[5].displayStyle"
    :caption="arizona[5].caption"
    :orientation="arizona[5].orientation"
  />
  <media-section
    :mediaType="arizona[6].type"
    :src="arizona[6].src"
    :displayStyle="arizona[6].displayStyle"
    :caption="arizona[6].caption"
    :orientation="arizona[6].orientation"
  />
</template>

<script setup lang="ts">
import { useFooterVisibility } from "../composables/useFooterVisibility";
import BottomNav from "../components/ui/BottomNav.vue";
import { arizona } from "../../public/data";

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
