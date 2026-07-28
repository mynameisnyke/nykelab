<!-- CaptionDisplay.vue -->
<template>
  <div v-if="caption" class="caption">
    <span class="location-title">{{ title }}</span>
    <span class="location-coords">{{ coordinates }}</span>
  </div>
</template>

<script setup lang="ts">
import {  computed } from "vue";

const props = defineProps({
  caption: String,
});
</script>

<style scoped>
.caption {
  color: white;
  opacity: 0.75;
  font-size: 11px;
  font-family: "Arial", sans-serif;
  text-align: center;
  position: absolute;
  bottom: 0;
}

.location-title {
  font-weight: bold;
}

.location-coords {
  font-weight: normal;
}
</style>
