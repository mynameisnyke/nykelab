// useFormattedText.js
import { computed } from 'vue';

export function useFormattedText(textProp: string) {
  const formattedText = computed(() => {
    // Replace newlines with a div that acts as a line break with a margin
    return textProp.replace(/\n/g, '<div class="line-break"></div>');
  });

  return { formattedText };
}
