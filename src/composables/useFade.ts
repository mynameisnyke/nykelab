// src/composables/useFade.ts
import { ref, Ref, onMounted } from "vue";

export function useFade(enableFade: boolean) {
  const elementRef: Ref<HTMLElement | null> = ref(null);

  const applyFade = () => {
    if (enableFade && elementRef.value) {
      setTimeout(() => {
        elementRef.value.classList.add("visible");
      }, 100); // Small delay to ensure fade effect
    }
  };

  onMounted(applyFade);

  return {
    elementRef,
  };
}
