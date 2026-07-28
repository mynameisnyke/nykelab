<template>
  <div class="pill-row">
    <slot></slot>
    <!-- Slot for pill buttons -->
  </div>
</template>

<style scoped>
.pill-row {
  display: flex;
  height: 32px;
  align-items: flex-start;
  gap: 12px;
  width: 100%;
}
</style>
