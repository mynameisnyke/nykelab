<template>
    <div class="gallery" :class="{ 'is-mobile': isMobile }">
      <div 
        v-for="(item, index) in galleryItems" 
        :key="index"
        class="gallery-item"
        :class="getLayoutClass(item.layout)"
        ref="galleryItems"
      >
        <GalleryImage
          :src="item.src"
          :alt="item.alt"
          :layout="item.layout"
          :caption="item.caption"
          :dimensions="item.dimensions"
          :isMobile="isMobile"
        />
      </div>
    </div>
  </template>
  
  <script setup lang="ts">
  import { computed, onMounted, ref } from 'vue';
  import GalleryImage from './GalleryImage.vue';
  
  interface GalleryItem {
    src: string;
    alt?: string;
    caption?: string;
    layout: 'full' | 'centered' | 'left' | 'right';
    dimensions?: {
      width: number;
      height: number;
    };
  }
  
  interface Props {
    items: GalleryItem[];
    isMobile: boolean;
  }
  
  const props = defineProps<Props>();
  
  const galleryItems = ref([]);
  
  const getLayoutClass = (layout: string) => {
    return {
      'gallery-item--full': layout === 'full',
      'gallery-item--centered': layout === 'centered',
      'gallery-item--left': layout === 'left',
      'gallery-item--right': layout === 'right',
    };
  };
  
  onMounted(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
        }
      });
    });

    // Get all gallery items and observe them
    const items = document.querySelectorAll('.gallery-item');
    items.forEach(item => observer.observe(item));
  });
  </script>
  
  <style scoped>
  .gallery {
    width: 100%;
    min-height: 100vh;
  }
  
  .gallery-item {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    scroll-snap-align: start;
  }
  
  .gallery-item--full {
    width: 100%;
  }
  
  .gallery-item--centered {
    width: 85%;
    margin-left: auto;
    margin-right: auto;
  }
  
  @media (min-width: 768px) {
    .gallery-item--centered {
      width: 65%;
    }
  }
  
  .gallery-item--left {
    width: 85%;
    margin-left: 5vw;
  }
  
  @media (min-width: 768px) {
    .gallery-item--left {
      width: 65%;
    }
  }
  
  .gallery-item--right {
    width: 85%;
    margin-right: 5vw;
  }
  
  @media (min-width: 768px) {
    .gallery-item--right {
      width: 65%;
    }
  }
  
  /* Fade in animation */
  .gallery-item {
    opacity: 0;
    transform: translateY(20px);
    transition: opacity 0.6s ease, transform 0.6s ease;
  }
  
  .gallery-item.is-visible {
    opacity: 1;
    transform: translateY(0);
  }
  </style>