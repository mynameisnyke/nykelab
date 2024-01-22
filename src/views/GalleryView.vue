<template>
  <MediaGallery :media="media" />
</template>

<script setup lang="ts">
import MediaGallery from "../components/ui/MediaGallery.vue";
import { teton_media } from "../../public/data";
import { Media } from "../models/media";

const media = teton_media.map((m) => new Media(m));
</script>
