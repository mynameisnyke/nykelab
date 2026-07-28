// useFormattedText.ts
import {  computed } from 'vue';

export function useFormattedText(textProp: string) {
  const formattedText = computed(() => {
    return textProp.replace(/\n/g, '<br>');
  });

  return { formattedText };
}
