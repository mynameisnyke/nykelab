<template>
  <button @click="handleClick" class="pill-button" :style="buttonStyles">
    <img v-if="icon" :src="icon" :alt="iconAlt" class="pill-icon" />
    <span class="pill-text">{{ text }}</span>
  </button>
</template>

<script setup lang="ts">
import { defineProps } from "vue";

const props = defineProps({
  text: {
    type: String,
    default: "Button Text",
  },
  icon: {
    type: String,
    default: "",
  },
  iconAlt: {
    type: String,
    default: "Icon",
  },
  url: {
    type: String,
    default: "",
  },
  email: {
    type: String,
    default: "",
  },
});

const buttonStyles = {
  display: "flex",
  height: "34px",
  padding: "7px 10.8px 7px 11px",
  justifyContent: "center",
  alignItems: "center",
  gap: "5.12px",
  borderRadius: "30px",
  border: "1px solid var(--Default-gray-100, #F3F4F6)",
};

function handleClick() {
  if (props.url) {
    // Opens the URL in a new tab
    window.open(props.url, "_blank");
  } else if (props.email) {
    // Opens the default email client
    window.location.href = `mailto:${props.email}`;
  }
}
</script>

<style scoped>
.pill-button {
  background: transparent;
  color: inherit;
  border: inherit;
  padding: inherit;
  border-radius: inherit;
  gap: inherit;
  display: inherit;
  justify-content: inherit;
  align-items: inherit;
}

.pill-icon {
  /* You can set a fixed size for the icon or make it configurable via props */
  width: 20px; /* Example fixed width */
  height: auto;
}

.pill-text {
  color: var(--Default-gray-100, #f3f4f6);
  font-family: Helvetica;
  text-align: right;
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: 15px; /* 125% */
}
</style>
