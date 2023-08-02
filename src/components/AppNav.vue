<template>
  <nav
    class="flex flex-row justify-between items-center gap-2 lg:px-8 lg:py-5 w-full fixed"
  >
    <!-- Dark Mode Toggle -->
    <Switch id="darkModeSwitch" @click="toggleDark()" />
    <!-- Page Links -->
    <ul class="flex flex-row items-start gap-4">
      <li>
        <router-link
          class="text-gray-400 font-medium lg:text-base lg:font-normal font-sans hover:text-gray-600 hover:dark:text-gray-100 transition-colors"
          to="/"
          active-class="active text-purple-300"
        >
          HOME
        </router-link>
      </li>
      <li>
        <router-link
          class="text-gray-400 font-medium lg:text-base lg:font-normal font-sans hover:text-gray-600 hover:dark:text-gray-100 transition-colors"
          to="/Blog"
          active-class="active text-purple-300"
        >
          BLOG
        </router-link>
      </li>
      <li>
        <router-link
          class="text-gray-400 font-medium lg:text-base lg:font-normal font-sans hover:text-gray-600 hover:dark:text-gray-100 transition-colors"
          to="/Gallery"
          active-class="active text-purple-300"
        >
          GALLERY
        </router-link>
      </li>
      <li>
        <router-link
          class="text-gray-400 font-medium lg:text-base lg:font-normal font-sans hover:text-gray-600 hover:dark:text-gray-100 transition-colors"
          to="/About"
          active-class="active text-purple-300"
        >
          ABOUT
        </router-link>
      </li>
    </ul>
  </nav>
</template>

<script setup lang="ts">
import Switch from "./ui/AppSwitch.vue";
import { useDark, useToggle } from "@vueuse/core";

let clicks = 0;

// Grab the state of dark for vueuse
const isDark = useDark();
const testEvent = function (e: any) {
  clicks++;
  console.log(`EVENT: ${e}`);
  console.log(`CLICKS: ${clicks}`);
};
const toggleDark = useToggle(isDark);
</script>

<style></style>
