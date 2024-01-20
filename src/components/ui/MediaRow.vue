<template>
  <section
    v-if="media.length === 2 && isPortraitLayout"
    class="two-media-section"
  >
    <div
      class="w-[1230px] h-[747.47px] justify-center items-center inline-flex"
    >
      <div class="justify-start items-start gap-[30px] inline-flex">
        <!-- Media Item 1 -->
        <div :class="mediaClass(media[0])">
          <img
            :src="media[0].src"
            alt="Media content 1"
            :class="imgClass(media[0])"
          />
          <div v-if="media[0].caption" class="caption">
            <span class="location-title">{{
              splitCaption(media[0].caption)[0]
            }}</span>
            <span class="location-coords">{{
              splitCaption(media[0].caption)[1]
            }}</span>
          </div>
        </div>

        <!-- Media Item 2 -->
        <div :class="mediaClass(media[1])">
          <img
            :src="media[1].src"
            alt="Media content 2"
            :class="imgClass(media[1])"
          />
          <div v-if="media[1].caption" class="caption">
            <span class="location-title">{{
              splitCaption(media[1].caption)[0]
            }}</span>
            <span class="location-coords">{{
              splitCaption(media[1].caption)[1]
            }}</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { defineProps, computed } from "vue";
import { Media } from "../../types/media";

interface Props {
  media: Media[];
}

const props = defineProps<Props>();

const mediaClass = (mediaItem: Media) => {
  if (mediaItem.orientation === "portrait") {
    return "media-item media-item--portrait";
  }
  return "media-item";
};

const imgClass = (mediaItem: Media) => {
  if (mediaItem.orientation === "portrait") {
    return "w-[600px] h-[747.47px] relative";
  }
  return "";
};

const splitCaption = (caption: string) => {
  return caption.split("\n");
};

// Computed property to check if both media items are portrait
const isPortraitLayout = computed(() => {
  return (
    props.media[0].orientation === "portrait" &&
    props.media[1].orientation === "portrait"
  );
});
</script>

<style scoped>
.two-media-section {
  width: 100vw;
  height: 100vh; /* Adjusted height */
  display: flex;
  overflow: hidden;
  justify-content: center;
  align-items: center;
  gap: 15px;
  flex-wrap: wrap; /* Allow the items to wrap onto the next line */
  margin-top: 300px;
  margin-bottom: 300px;
}
.two-media-section .portrait {
  justify-content: center;
}

.media-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-width: 0; /* To prevent flex items from growing beyond container bounds */
}

/* .media-item img {
  width: 100%;
  height: auto;
  display: block;
} */

.caption {
  color: white;
  opacity: 0.75;
  font-size: 11px;
  font-family: "Arial", sans-serif;
  margin-top: 16px;
  text-align: center;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.location-title {
  display: block;
  font-weight: bold; /* Bolding the location name */
  line-height: 1.25; /* Adjust line-height if needed */
}

.location-coords {
  display: block;
  line-height: 1.25; /* Adjust line-height if needed */
  opacity: 0.85;

  /* Mobile Responsive Styles */
  @media (max-width: 768px) {
    /* Adjust this breakpoint as needed */
    .two-media-section {
      flex-direction: column; /* Stack items vertically */
    }
    .media-item--portrait {
      width: 600px;
      height: 747.47px;
      background-color: #262629; /* Equivalent to bg-zinc-900 in Tailwind */
      display: inline-flex; /* Inline flex will make it work within your flex container */
      flex-direction: column;
      justify-content: center;
      align-items: center;
    }

    .media-item--portrait img {
      width: 600px;
      height: 747.47px;
    }
  }
}
</style>
