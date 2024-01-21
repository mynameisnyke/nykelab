<!-- About -->
<template>
  <BackgroundImage
    @media-loaded="contentVisible = true"
    media-type="image"
    media-url="https://storage.googleapis.com/nykelab-dev/teton/landscape/desktop-full-L1180042.webp"
    alt-text="Background Image"
  >
    <CenteredContent :isVisible="contentVisible">
      <TextBlock class="mt-2" :text="text" />
      <PillRow>
        <PillButton text="Github" url="https://github.com/mynameisnyke" />
        <PillButton
          text="LinkedIn"
          url="https://www.linkedin.com/in/nyke-harewood/"
        />
        <PillButton text="Email" email="nyke@nykelab.nyc" />
      </PillRow>
    </CenteredContent>
  </BackgroundImage>
</template>

<script setup lang="ts">
import { ref } from "vue";
import TextBlock from "../components/ui/TextBlock.vue";
import CenteredContent from "../components/ui/CenteredContent.vue";
import PillRow from "../components/ui/PillRow.vue";
import PillButton from "../components/ui/PillButton.vue";
import BackgroundImage from "../components/BackgroundImage.vue";
import { useNoScroll } from "../composables/noScroll";

const text =
  "Nykelab is a custom web application developed by me. Both the front and back source code repos are publicly accessible,as well as the figma designs\nWith over a decade of experience in the digital media industry, I've been privileged to see my photographs published and have developed various applications to bolster these companies.\n In addition to my creative contributions, I have played a key role in building out the digital and physical infrastructure for these companies, encompassing both cloud-based and on-premises solutions.\nAll photos and videos are owned and captured by Nyke Harewood";
const contentVisible = ref(false);

const handleLoad = () => {
  setTimeout(() => {
    contentVisible.value = true;
  }, 2);
};

// Disable overflow on this page
useNoScroll();
</script>

<style scoped></style>
