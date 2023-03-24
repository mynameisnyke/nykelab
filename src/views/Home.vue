<template>
  <AppNav />
  <div class="grid h-screen grid-cols-12 gap-5 mx-8 place-items-center">
    <!-- Vertical -->

    <div
      id="image-container"
      class="flex flex-col gap-2 col-span-4 col-start-5"
    >
      <img
        src="https://storage.googleapis.com/nykelab-photos-source/vertical/day/westminster-2020/DSC09231.jpg"
        alt=""
        srcset=""
        class="object-cover max-h-[900px]"
      />
      <!-- Image Label -->
      <div id="meta" class="flex flex-col">
        <span
          id="img title"
          class="text-lg font-semibold text-gray-800 dark:text-gray-50 leading-none"
          >Westminster Dog Show, New York</span
        >
        <span class="text-md text-gray-400 text-sm leading-none"
          >2020 - Views</span
        >
      </div>
    </div>

    <!-- Horizontal -->
    <!-- <div
      id="image-container"
      class="flex flex-col gap-2 col-span-8 col-start-3 xl:col-span-8 xl:col-start-3 2xl:col-span-6 2xl:col-start-4"
    >
      <img
        src="https://storage.googleapis.com/nykelab-photos-source/horizontal/day/_7M33919-2-HDR.jpg"
        alt=""
        srcset=""
        class="aspect-auto"
      />
      Image Label
      <div id="meta" class="flex flex-col">
        <span
          id="img title"
          class="text-lg font-semibold text-gray-800 dark:text-gray-50 leading-none"
          >Westminster Dog Show, New York</span
        >
        <span class="text-md text-gray-400 text-sm leading-none"
          >2020 - Views</span
        >
      </div>
    </div> -->
  </div>
</template>

<script setup lang="ts">
import AppNav from "../components/AppNav.vue";
</script>

<style></style>
