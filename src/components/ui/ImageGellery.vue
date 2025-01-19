<template>
  <div class="image-gallery" @scroll="handleScroll">
    <div class="grid">
      <div v-for="(mediaItem, index) in displayedMedia" :key="index" class="grid-item">
        <img :src="mediaItem.src" :alt="mediaItem.name" class="image" :class="{ 'fade-in': mediaItem.loaded }" @load="onImageLoad(index)" />
      </div>
    </div>
    <div v-if="loading" class="loading">Loading...</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { Media } from '../../models/media';

const props = defineProps({
  media: {
    type: Array as () => Media[],
    required: true,
  },
});

const displayedMedia = ref<(Media & { loaded: boolean })[]>([]);
const loading = ref(false);
const itemsPerPage = 20;
let currentPage = 0;

const loadMoreItems = () => {
  if (loading.value) return;
  loading.value = true;
  setTimeout(() => {
    const start = currentPage * itemsPerPage;
    const end = start + itemsPerPage;
    const newItems = props.media.slice(start, end).map(item => ({ ...item, loaded: false }));
    displayedMedia.value.push(...newItems);
    currentPage++;
    loading.value = false;
  }, 1000); // Simulate network delay
};

const handleScroll = (event: Event) => {
  const target = event.target as HTMLElement;
  if (target.scrollHeight - target.scrollTop === target.clientHeight) {
    loadMoreItems();
  }
};

const onImageLoad = (index: number) => {
  displayedMedia.value[index].loaded = true;
};

onMounted(() => {
  loadMoreItems();
});

watch(() => props.media, () => {
  displayedMedia.value = [];
  currentPage = 0;
  loadMoreItems();
});
</script>

<style scoped>
.image-gallery {
  height: 100vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  padding: 16px;
  max-width: 800px;
  margin: 0 auto;
}

@media (min-width: 768px) {
  .grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.grid-item {
  position: relative;
}

.image {
  width: 100%;
  height: auto;
  display: block;
  opacity: 0;
  transition: opacity 0.5s ease-in-out;
}

.image.fade-in {
  opacity: 1;
}

.loading {
  text-align: center;
  padding: 16px;
}
</style>
