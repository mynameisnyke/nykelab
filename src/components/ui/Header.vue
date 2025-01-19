<template>
  <header
    class="w-full h-10 px-8 pt-2.5 pb-1.5 flex justify-between items-center z-20"
    ref="headerRef"
  >
    <!-- Center section -->
    <div class="flex-grow flex items-center justify-center">
      <img :src="nykelablogo" alt="Logo" srcset="" />
    </div>

    <!-- Right section -->
    <div class="flex items-center justify-end">
      <router-link
        :to="isAboutPage ? '/' : '/about'"
        custom
        v-slot="{ navigate }"
      >
        <div
          class="text-center text-white text-xs font-normal font-['Helvetica'] tracking-tight cursor-pointer"
          @click="navigate"
        >
          <span>{{ isAboutPage ? "Home" : "About" }}</span>
        </div>
      </router-link>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute } from "vue-router";
import { useScrollFade } from "../../composables/useGsapScrollFade";
import nykelablogo from "@/assets/logo.svg";

const headerRef = ref<HTMLElement | null>(null);
useScrollFade(headerRef);

const route = useRoute();
const isAboutPage = computed(() => route.path === "/about");
</script>

<style></style>
