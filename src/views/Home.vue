<template>
  <div class="home-container">
    <div class="chart-wrapper">
      <MediaSunburst
        v-if="mediaData"
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
    
    <BottomNav :class="footerClass" v-if="footerVisible" class="fixed-bottom" :navItems="navItems" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import { useFooterVisibility } from "../composables/useFooterVisibility";
import { useCollections } from "../composables/useCollections";
import BottomNav from "../components/ui/BottomNav.vue";
import MediaSunburst from "../components/MediaSunburst.vue";

const router = useRouter();
const { collections, navItems } = useCollections();

// Two rings (type -> collection), sized by how much is in each collection.
// Hidden until there is something published to show.
const mediaData = computed(() => {
  const ring = (key: "images" | "videos") =>
    collections.value
      .filter((c) => c[key] > 0)
      .map((c) => ({ name: c.title, size: c[key] }));
  const photos = ring("images");
  const videos = ring("videos");
  const children = [
    ...(photos.length ? [{ name: "Photos", children: photos }] : []),
    ...(videos.length ? [{ name: "Videos", children: videos }] : []),
  ];
  return children.length ? { name: "Media", children } : null;
});

const currentPath = ref<string[]>([]);
const enableFade = ref(false);
const { footerVisible, toggleVisibility, footerClass } = useFooterVisibility();

const handleNavigation = (path: string[]) => {
  currentPath.value = path;
  // A click on an outer-ring arc is a collection: go there.
  if (path.length === 2) {
    const target = collections.value.find((c) => c.title === path[1]);
    if (target) router.push(`/${target.slug}`);
  }
};

const navigateToLevel = (index: number) => {
  currentPath.value = currentPath.value.slice(0, index + 1);
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
