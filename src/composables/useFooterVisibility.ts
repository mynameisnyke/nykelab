// useFooterVisibility.js
import { ref, computed } from 'vue';

export function useFooterVisibility() {
  const footerVisible = ref(true);

  const toggleVisibility = (isPassed) => {
    footerVisible.value = !isPassed;
  };

  const footerClass = computed(() => {
    return footerVisible.value ? "fixed-bottom" : "hidden";
  });

  return { footerVisible, toggleVisibility, footerClass };
}
