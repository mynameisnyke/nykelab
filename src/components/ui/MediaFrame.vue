<template>
  <section class="media-section" :class="displayStyle">
    <!-- Video rendering -->
    <video
      v-if="mediaType === 'video' && src"
      class="media"
      autoplay
      loop
      muted
    >
      <source :src="src" type="video/mp4" />
      Your browser does not support the video tag.
    </video>

    <!-- Image rendering -->
    <img
      v-else-if="mediaType === 'image' && src"
      class="media"
      :src="src"
      alt="Media content"
    />

    <!-- Caption rendering -->
    <div v-if="caption" class="hidden lg:block absolute caption">
      {{ caption }}
    </div>
  </section>
</template>

<script setup lang="ts">
import { defineProps } from "vue";

const props = defineProps({
  mediaType: {
    type: String,
    required: true,
  },
  src: {
    type: String,
    required: true,
  },
  displayStyle: {
    type: String,
    default: "centered",
  },
  caption: {
    type: String,
    default: "This is a test",
  },
});
</script>

<style scoped>
.media-section {
  position: relative; /* Required for caption positioning */
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
}

.media {
  max-width: 100%;
  max-height: 100%;
  object-fit: cover;
}

.caption {
  position: absolute;
  bottom: 16px; /* 16px away from the media */
  left: 50%;
  transform: translateX(-50%);
  color: white;
  opacity: 0.75;
  font-size: 11px;
  font-family: "Arial", sans-serif;
  line-height: 1;
}

/* Fullscreen media style */
.media-section.fullscreen .media {
  width: 100%;
  height: 100%;
}

/* Centered style (default) */
.media-section.centered .media {
  width: 1230px;
  height: 818.8px;
}

/* Two-column centered style */
.media-section.two-col-centered {
  flex-direction: row;
}
.media-section.two-col-centered .media {
  width: 50%;
  height: 100%;
}

/* Hide caption on mobile devices */
@media (max-width: 768px) {
  .caption {
    display: none;
  }
}
</style>
