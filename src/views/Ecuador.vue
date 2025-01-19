<!-- Ecuador  -->
<template>
  <transition name="fade">
    <BottomNav class="fixed-bottom" />
  </transition>
  <!-- Media 1 Full  -->
  <FullScreenMedia :media="media_1" class="mb-40" />
  <!-- Media 2 Centerted -->
  <CenteredMedia :media="media_2" :enableFade="true" class="mb-40" />
  <!-- Media 3 Extended -->
  <section
    class="min-h-screen w-full flex flex-col justify-center items-center gap-5 mb-40"
  >
    <MediaDisplay
      id="3"
      :media="media_3"
      :enableFade="true"
      width="w-[85%] md:w-[600px] lg:md:w-[1230px]"
      objectFit="cover"
    />
    <MediaCaption :media="media_2" :enableFade="true" />
  </section>
  <!-- Media 6 Full -->
  <FullScreenMedia :media="media_5" />
</template>

<script setup lang="ts">
import { inject } from "vue";
import BottomNav from "../components/ui/BottomNav.vue";
import { ecuador } from "../../public/data";
import { Media } from "../models/media";
import MediaDisplay from "../components/ui/MediaDisplay.vue";
import MediaCaption from "../components/ui/MediaCaption.vue";
import FullScreenMedia from "../components/ui/FullScreenMedia.vue";
import CenteredMedia from "../components/ui/CenteredMedia.vue";

// Inject device type
const mobile: boolean = inject("mobile")!;

const media_1 = new Media(ecuador[0]);
const media_2 = new Media(ecuador[1]);
const media_3 = new Media(ecuador[2]);
const media_4 = new Media(ecuador[3]);
const media_5 = new Media(ecuador[4]);
</script>
