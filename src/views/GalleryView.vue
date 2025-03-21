<template>
  <Gallery 
    :items="galleryItems"
    :isMobile="isMobile"
  />
</template>

<script setup lang="ts">
import { ref, inject } from 'vue';
import Gallery from '../components/Gallery/Gallery.vue';

const isMobile = inject('mobile', false);



const galleryItems = ref([{
  src: "https://storage.googleapis.com/nykelab-dev/images/desktop-full-AR500190.webp",
  layout: 'full',
}, {
  src: "https://storage.googleapis.com/nykelab-dev/DSC00444.jpg",
  layout: 'centered',
}, {
  src: "https://storage.googleapis.com/nykelab-dev/images/desktop-full-AR500190.webp",
  layout: 'centered',
}]);


</script>
