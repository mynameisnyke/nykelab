<template>
  <div class="home-container">
    <div class="chart-wrapper">
      <MediaSunburst 
        :data="mediaData" 
        @navigate="handleNavigation" 
        :enableFade="enableFade"
      />
    </div>
    
    <div v-if="currentPath.length" class="breadcrumb-container">
      <div class="breadcrumb">
        <span 
          v-for="(item, index) in currentPath" 
          :key="index"
          @click="navigateToLevel(index)"
          :class="{ active: index === currentPath.length - 1 }"
        >
          {{ item }} {{ index < currentPath.length - 1 ? '>' : '' }}
        </span>
      </div>
    </div>
    
    <BottomNav :class="footerClass" v-if="footerVisible" class="fixed-bottom" :navItems="navigationItems" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useFooterVisibility } from "../composables/useFooterVisibility";
import BottomNav from "../components/ui/BottomNav.vue";
import CenteredContent from "../components/ui/CenteredContent.vue";
import MediaSunburst from "../components/MediaSunburst.vue";

// Define navigation items for the bottom nav
const navigationItems = [
  { label: 'Home', icon: 'home', route: '/', number: '0', link: '/' },
  { label: 'Images', icon: 'image', route: '/gallery/images', number: '1', link: '/gallery/images' },
  { label: 'Videos', icon: 'video', route: '/gallery/videos', number: '2', link: '/gallery/videos' },
  { label: 'Favorites', icon: 'star', route: '/favorites', number: '3', link: '/favorites' }
];

// Media data structure — kept to two rings (category, subcategory)
// so the sunburst stays legible at a compact size.
const mediaData = {
  name: "Media",
  children: [
    {
      name: "Photos",
      children: [
        { name: "Nature", size: 15 },
        { name: "People", size: 12 },
        { name: "Urban", size: 10 },
      ],
    },
    {
      name: "Videos",
      children: [
        { name: "Travel", size: 8 },
        { name: "Family", size: 15 },
        { name: "Pets", size: 10 },
      ],
    },
  ],
};

const currentPath = ref<string[]>([]);
const enableFade = ref(false);
const { footerVisible, toggleVisibility, footerClass } = useFooterVisibility();

const handleNavigation = (path: string[]) => {
  currentPath.value = path;
  // You could also navigate to a different route here if needed
  console.log(`Navigated to: ${path.join(' > ')}`);
};

const navigateToLevel = (index: number) => {
  currentPath.value = currentPath.value.slice(0, index + 1);
  // You could also navigate to a different route here if needed
  console.log(`Navigated to level: ${currentPath.value.join(' > ')}`);
};
</script>

<style scoped>
.home-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: #000000;
  color: #fff;
  padding: 2rem 1rem;
}

.chart-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  max-width: 360px;
}

.breadcrumb-container {
  margin-top: 2rem;
  width: 100%;
  display: flex;
  justify-content: center;
  z-index: 10;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.breadcrumb span {
  cursor: pointer;
  font-family: "Arial", sans-serif;
  font-weight: 700;
  font-size: 0.75rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.5);
  transition: color 0.2s ease;
}

.breadcrumb span:hover {
  color: rgba(255, 255, 255, 0.9);
}

.breadcrumb span.active {
  color: rgba(255, 255, 255, 0.9);
}
</style>
