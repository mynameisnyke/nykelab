<template>
  <header
    class="w-full h-10 px-8 pt-2.5 pb-1.5 flex justify-between items-center z-10"
  >
    <!-- Left section with the SVG -->
    <div class="flex items-center justify-center">
      <img :src="hamburgerIcon" alt="Hamburger Menu" class="w-4 h-auto" />
    </div>

    <!-- Center section -->
    <div class="flex items-center justify-center">
      <img :src="nykelablogo" alt="Logo" srcset="" />
    </div>

    <!-- Right section -->
    <div class="flex items-center justify-end">
      <router-link
        :to="isAboutPage ? '/' : '/about'"
        tag="div"
        class="text-center text-white text-xs font-normal font-['Helvetica'] tracking-tight"
      >
        <span>{{ isAboutPage ? "Home" : "About" }}</span>
      </router-link>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import hamburgerIcon from "@/assets/hamburger.svg";
import nykelablogo from "@/assets/logo.svg";

const route = useRoute();
const isAboutPage = computed(() => route.path === "/about");
</script>

<style></style>
