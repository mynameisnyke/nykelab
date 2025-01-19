<template>
  <!-- Textblock -->
  <p class="text-block" v-html="formattedText"></p>
</template>

<script setup lang="ts">
import {  ref } from "vue";
import { useFormattedText } from "../../composables/useFormattedText";

const props = defineProps({
  text: String,
});

const { formattedText } = useFormattedText(props.text!);
</script>

<style>
.text-block {
  max-width: 531px;
  color: var(--Default-gray-200, #e5e7eb);
  font-family: Helvetica;
  font-size: 17px;
  font-style: normal;
  font-weight: 200;
  line-height: 21.25px; /* 125% */
  position: relative; /* Add position relative */
  z-index: 2; /* Position above the background image */
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5),
    /* Shadow to the right and bottom */ -2px -2px 4px rgba(0, 0, 0, 0.5),
    /* Shadow to the left and top */ -2px 2px 4px rgba(0, 0, 0, 0.5),
    /* Shadow to the left and bottom */ 2px -2px 4px rgba(0, 0, 0, 0.5); /* Shadow to the right and top */
}

/* Class to add space for custom line breaks */
.text-block .line-break {
  height: 1em; /* Adjust the space for the line break */
  display: block; /* This makes it behave like a paragraph break */
}
</style>
