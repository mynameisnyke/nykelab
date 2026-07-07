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

// Improved media data structure with more intuitive categories
const mediaData = {
  name: "Media",
  children: [
    {
      name: "Photos",
      children: [
        {
          name: "Nature",
          children: [
            { name: "Landscapes", size: 15 },
            { name: "Wildlife", size: 12 },
            { name: "Plants", size: 8 }
          ]
        },
        {
          name: "People",
          children: [
            { name: "Portraits", size: 10 },
            { name: "Groups", size: 8 },
            { name: "Events", size: 12 }
          ]
        },
        {
          name: "Urban",
          children: [
            { name: "Architecture", size: 14 },
            { name: "Street", size: 10 },
            { name: "Night", size: 6 }
          ]
        }
      ]
    },
    {
      name: "Videos",
      children: [
        {
          name: "Travel",
          children: [
            { name: "Cities", size: 8 },
            { name: "Wilderness", size: 6 }
          ]
        },
        {
          name: "Family",
          size: 15
        },
        {
          name: "Pets",
          size: 10
        }
      ]
    },
  ]
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
  justify-content: center; /* Center vertically */
  min-height: 100vh;
  background: #000000;
  color: #fff;
  padding: 0; /* Remove padding to allow full centering */
}

.chart-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  max-width: 900px;
}

.breadcrumb-container {
  margin-top: 1.5rem;
  width: 100%;
  display: flex;
  justify-content: center;
  z-index: 10;
}

.breadcrumb {
  background: rgba(255, 255, 255, 0.1);
  padding: 0.75rem 1.5rem;
  border-radius: 30px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.breadcrumb span {
  cursor: pointer;
  margin: 0 0.5rem;
  color: #00B894; /* Using the mint accent color */
  font-weight: 500;
  transition: all 0.2s ease;
}

.breadcrumb span:hover {
  color: #fff;
  transform: translateY(-1px);
}

.breadcrumb span.active {
  color: #6C5CE7; /* Using the purple accent color */
  font-weight: 600;
}

@media (max-width: 640px) {
  .breadcrumb {
    font-size: 0.9rem;
    padding: 0.5rem 1rem;
  }
}
</style>
