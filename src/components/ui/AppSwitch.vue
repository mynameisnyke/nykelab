<template>
  <div>
    <input type="checkbox" :id="id" class="toggle" />
    <!-- Prevent click event from firing twice -->
    <label :for="id" @click.stop></label>
  </div>
</template>

<script setup lang="ts">
const props = defineProps({
  id: String,
});
</script>

<style>
/* Hide the default checkbox */
input[type="checkbox"].toggle {
  opacity: 0;
  position: absolute;
  cursor: pointer;
  left: -9000px;
  top: -9000px;
}

input[type="checkbox"].toggle + label {
  position: relative;
  display: flex;
  align-items: center;
  cursor: pointer;
}

input[type="checkbox"].toggle + label::before {
  content: "";
  width: 2em;
  height: 1em;
  background: linear-gradient(180deg, #b8b8b8 0%, #dcdcdc 100%);
  border-radius: 1em;
  transition: 200ms ease-in-out;
}

input[type="checkbox"].toggle + label::after {
  position: absolute;
  left: 0.1em;
  content: "";
  width: 0.9em;
  height: 0.9em;
  background: linear-gradient(180deg, #ffffff 0%, #f7f7f7 100%);
  border-radius: 1em;
  transition: 200ms ease-in-out;
}
/* When checked */
input[type="checkbox"].toggle:checked + label::before {
  content: "";
  width: 2em;
  height: 1em;
  background: linear-gradient(180deg, #2d2d2d 0%, #686868 100%);
  border-radius: 1em;
  transition: 200ms ease-in-out;
}

input[type="checkbox"].toggle:checked + label::after {
  transform: translateX(100%);
  transition: 200ms ease-in-out;
}
</style>
