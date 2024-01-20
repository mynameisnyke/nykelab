<template>
  <div class="background">
    <img
      v-if="mediaType === 'image' && mediaUrl"
      :src="mediaUrl"
      :alt="altText"
      class="background-media"
    />
    <video
      v-if="mediaType === 'video' && mediaUrl"
      :src="mediaUrl"
      class="background-media"
      autoplay
      loop
      muted
    ></video>
    <slot></slot>
    <!-- Slot for content on top of the background image or video -->
  </div>
</template>

<script setup>
import { defineProps } from "vue";

const props = defineProps({
  mediaType: {
    type: String,
    required: true,
    validator: (value) => ["image", "video"].includes(value),
  },
  mediaUrl: {
    type: String,
    required: true,
  },
  altText: String,
});
</script>

<style>
.background {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100vw;
  height: 100vh;
  position: relative;
  overflow: hidden;
}

.background-media {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 0; /* Media is behind the overlay */
}
</style>
