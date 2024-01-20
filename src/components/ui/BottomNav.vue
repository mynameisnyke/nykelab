<template>
  <div class="h-24 p-8 justify-between items-start inline-flex z-10">
    <div
      class="justify-start items-start gap-1 flex overflow-x-auto no-scrollbar"
    >
      <router-link exact to="/" tag="div" class="router-link-hovered">
        <FooterItem number="1" label="Home" />
      </router-link>
      <router-link exact to="/arizona" class="router-link-hovered" tag="div">
        <FooterItem number="3" label="Arizona" />
      </router-link>
      <router-link exact to="/teton" tag="div" class="router-link-hovered">
        <FooterItem number="2" label="Wyoming" />
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import FooterItem from "./FooterItem.vue";
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
