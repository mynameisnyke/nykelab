<!-- About -->
<template>
  <BackgroundImage
    media-type="image"
    media-url="https://storage.googleapis.com/nykelab-dev/teton/landscape/L1180042.jpg"
    alt-text="Background Image"
  >
    <CenteredContent>
      <TextBlock class="mt-2" :text="text" />
      <PillRow>
        <PillButton
          text="Github"
          icon="/public/github-mark-white.svg"
          url="https://github.com/mynameisnyke"
        />
        <PillButton
          text="LinkedIn"
          icon="/public/In-White-48@2x.png"
          url="https://www.linkedin.com/in/nyke-harewood/"
        />
        <PillButton
          text="Email"
          icon="/public/email.svg"
          email="nyke@nykelab.nyc"
        />
        <!-- Add as many PillButton components as needed -->
      </PillRow>
    </CenteredContent>
  </BackgroundImage>
</template>

<script setup lang="ts">
//   We want to make sure that there is no overflow, so we'll dynamically add a class to prevent that.
import TextBlock from "../components/ui/TextBlock.vue";
import CenteredContent from "../components/ui/CenteredContent.vue";
import PillRow from "../components/ui/PillRow.vue";
import PillButton from "../components/ui/PillButton.vue";
import BackgroundImage from "../components/BackgroundImage.vue";
import { useNoScroll } from "../composables/noScroll";

const text =
  "Nykelab is a custom web application developed by me. Both the front and back source code repos are publicly accessible,as well as the figma designs\nWith over a decade of experience in the digital media industry, I've been privileged to see my photographs published and have developed various applications to bolster these companies.\n In addition to my creative contributions, I have played a key role in building out the digital and physical infrastructure for these companies, encompassing both cloud-based and on-premises solutions.\nAll photos and videos are owned and captured by Nyke Harewood.";

// Disable overlflow on this page
useNoScroll();
</script>
