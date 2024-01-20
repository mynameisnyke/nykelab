<template>
  <!-- SVG filter definition -->
  <svg xmlns="http://www.w3.org/2000/svg" version="1.1" class="hidden">
    <defs>
      <filter id="wavy">
        <feTurbulence x="0" y="0" baseFrequency="0.01" numOctaves="3" seed="2">
          <animate
            attributeName="baseFrequency"
            dur="3s"
            values="0.01;0.03;0.01"
            repeatCount="indefinite"
          />
        </feTurbulence>
        <feDisplacementMap in="SourceGraphic" scale="5" />
      </filter>
    </defs>
  </svg>

  <main>
    <app-nav class="fixed top-0" />
    <router-view />
  </main>
</template>

<script lang="ts">
export default {};
</script>

<style>
body,
html {
  min-height: 100vh;
  background-color: black;
  overflow-x: hidden; /* Prevent horizontal scrolling */
  max-width: 100%; /* Ensure content doesn't exceed viewport width */
}

/* Hide scrollbar for Chrome, Safari and Opera */
.no-scrollbar::-webkit-scrollbar {
  display: none;
}

/* Hide scrollbar for IE, Edge and Firefox */
.no-scrollbar {
  -ms-overflow-style: none; /* IE and Edge */
  scrollbar-width: none; /* Firefox */
}
</style>
