<template>
  <div class="pill-row">
    <slot></slot>
    <!-- Slot for pill buttons -->
  </div>
</template>

<script setup>
// Script setup can be empty if no additional logic is needed
</script>

<style scoped>
.pill-row {
  display: flex;
  height: 32px;
  align-items: flex-start;
  gap: 12px;
  width: 100%;
}
</style>
