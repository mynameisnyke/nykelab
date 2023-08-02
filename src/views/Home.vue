<template>
  <AppNav />
  <div class="grid grid-cols-12 gap-5 w-full h-screen place-items-center">
    <MediaFrame :media="landsacpeMedia" :fadeIn="true" />
  </div>
</template>

<script setup lang="ts">
import AppNav from "../components/AppNav.vue";
import MediaFrame from "../components/ui/MediaFrame.vue";
import { Media } from "../types/media";
import { ref } from "vue";

const verticalMedia: Media = {
  src: "https://storage.googleapis.com/nykelab-photos-source/vertical/day/westminster-2020/DSC09231.jpg",
  fileType: "image/jpg",
  name: "Westminister 2021, New York",
  orientation: "vertical",
  id: "vertical-test",
};
const verticalMedia2: Media = {
  src: "https://storage.googleapis.com/nykelab-photos-source/vertical/day/Brooklyn/7M300332.jpg",
  fileType: "image/jpg",
  orientation: "vertical",
  id: "vertical-test-2",
};

const landsacpeMedia: Media = {
  src: "https://storage.googleapis.com/nykelab-photos-source/horizontal/day/_7M33919-2-HDR.jpg",
  fileType: "image/jpg",
  orientation: "landscape",
  id: "landscape-test",
  name: "Papago Park, Arizona",
  dateCreated: "12/1/2023",
};
const landsacpeMedia2: Media = {
  src: "https://storage.googleapis.com/nykelab-photos-source/horizontal/dark/DSC05587.jpg",
  fileType: "image/jpg",
  orientation: "landscape",
  id: "landscape-test-2",
  name: "Papago Park, Arizona",
  dateCreated: "12/1/2023",
};
const landsacpeMedia3: Media = {
  src: "https://storage.googleapis.com/avi-proxies/C0009-720p.mp4",
  fileType: "video/mp4",
  orientation: "landscape",
  id: "landscape-test-3",
  name: "Downtwon Brooklyn, New York",
  dateCreated: "12/1/2023",
};

const horizontalMedia: Media[] = [landsacpeMedia, landsacpeMedia2];

const onMediaChange = (media: Media) => {
  console.log("Current media changed:", media);
};

let maxHeight = ref("500px");
</script>

<style></style>
