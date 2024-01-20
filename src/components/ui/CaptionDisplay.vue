<!-- CaptionDisplay.vue -->
<template>
  <div v-if="caption" class="caption">
    <span class="location-title">{{ title }}</span>
    <span class="location-coords">{{ coordinates }}</span>
  </div>
</template>

<script setup lang="ts">
import { defineProps, computed } from "vue";

const props = defineProps({
  caption: String,
});

const splitCaption = computed(() => {
  return props.caption ? props.caption.split("\n") : ["", ""];
});

const title = computed(() => splitCaption.value[0]);
const coordinates = computed(() => splitCaption.value[1]);
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
