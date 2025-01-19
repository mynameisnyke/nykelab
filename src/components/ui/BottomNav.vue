<template>
  <transition name="fade">
    <div v-if="isVisible" class="h-24 p-8 justify-between items-start inline-flex z-20" ref="bottomNavRef">
      <div class="justify-start items-start gap-1 flex overflow-x-auto no-scrollbar">
        <router-link v-for="(item, index) in navItems" :key="index" :to="item.link" class="router-link-hovered" tag="div">
          <FooterItem :number="item.number" :label="item.label" />
        </router-link>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, PropType } from "vue";
import FooterItem from "./FooterItem.vue";
import { useScrollFade } from "../../composables/useGsapScrollFade";

interface NavItem {
  number: string;
  label: string;
  link: string;
}

const props = defineProps({
  isVisible: {
    type: Boolean,
    default: true,
  },
  navItems: {
    type: Array as PropType<NavItem[]>,
    required: true,
  },
});

const bottomNavRef = ref<HTMLElement | null>(null);
useScrollFade(bottomNavRef);
</script>

<style>
/* Hide scrollbar for Chrome, Safari and Opera */
.no-scrollbar::-webkit-scrollbar {
  display: none;
}

/* Hide scrollbar for IE, Edge and Firefox */
.no-scrollbar {
  -ms-overflow-style: none; /* IE and Edge */
  scrollbar-width: none; /* Firefox */
}

.fixed-bottom {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
}

/* Hover State Animation */
.router-link-hovered {
  transition: background-color 0.3s, color 0.3s; /* smooth transition for hover effects */
  padding: 4px 6px; /* Padding to give space for the background color */
  border-radius: 0px; /* Rounded corners for a softer look */
}

.router-link-hovered:hover {
  background-color: rgba(
    255,
    255,
    255,
    0.1
  ); /* slightly white background on hover */
  color: rgba(255, 255, 255, 0.9); /* brighter text color on hover */
}

/* Active State */
.router-link-hovered.router-link-active {
  background-color: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.9);
}
</style>
