<template>
  <ImageGallery :media="media" />
</template>

<script setup lang="ts">
import ImageGallery from "../components/ui/ImageGellery.vue";
import { arizona } from "../../public/data";
import { Media } from "../models/media";

const media = arizona.map((m) => new Media(m));

</script>
