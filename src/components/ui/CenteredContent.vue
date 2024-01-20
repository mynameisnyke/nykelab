<template>
  <div class="centered-content">
    <slot></slot>
    <!-- Slot for nested content -->
  </div>
</template>

<style scoped>
.centered-content {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  position: absolute;
  top: 0;
  left: 50%; /* Center the content horizontally */
  transform: translateX(-50%); /* Offset the div by half its width */
  width: 100%; /* Full width to respect max-width */
  max-width: 531px; /* Your desired max-width */
  height: 100%;
  z-index: 2;
  gap: 19.8px;
}
</style>
