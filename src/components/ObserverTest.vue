<template>
  <div :id="propid"></div>
</template>

<script setup lang="ts">
import { onMounted } from "vue";

const props = defineProps({
  propid: String,
});
// Lazy loading
onMounted(() => {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting && entry.intersectionRatio === 1) {
        console.log("Test prop in sight");
      }
    });
  });
  const ele = document.querySelector("#" + props.propid!);
  observer.observe(ele!);
});
</script>

<style></style>
