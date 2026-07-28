<template>
    <div 
      class="gallery-image-container"
      :class="[layoutClass, { 'is-mobile': isMobile }]"
    >
      <img
        :src="src"
        :alt="alt"
        class="gallery-image"
        :class="{ 'is-loading': loading }"
        @load="onImageLoad"
        loading="lazy"
      />
      <div v-if="caption" class="image-caption">
        {{ caption }}
      </div>
    </div>
  </template>
  
  <script setup lang="ts">
  import { ref, computed } from 'vue';
  
  interface Props {
    src: string;
    alt?: string;
    caption?: string;
    layout: 'full' | 'centered' | 'left' | 'right';
    dimensions?: {
      width: number;
      height: number;
    };
    isMobile?: boolean;
  }
  
  const props = defineProps<Props>();
  const loading = ref(true);
  
  const layoutClass = computed(() => `layout-${props.layout}`);
  
  const onImageLoad = () => {
    loading.value = false;
  };
  </script>
  
  <style scoped>
  .gallery-image-container {
    position: relative;
    width: 100%;
    height: 100%;
  }
  
  .gallery-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: opacity 0.3s ease;
  }
  
  .gallery-image.is-loading {
    opacity: 0;
  }
  
  .image-caption {
    position: absolute;
    bottom: 1rem;
    left: 1rem;
    color: white;
    font-size: 0.875rem;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
  }
  
  /* Layout specific styles */
  .layout-full .gallery-image {
    height: 100vh;
  }
  
  .layout-centered .gallery-image {
    max-height: 80vh;
  }
  
  .layout-left .gallery-image,
  .layout-right .gallery-image {
    max-height: 70vh;
  }
  </style>