// useFormattedText.ts
import { computed } from 'vue';

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export function useFormattedText(textProp: string) {
  const formattedText = computed(() => {
    // Captions come from the admin and are rendered with v-html, so escape
    // first; only the line-break markup below is trusted.
    return escapeHtml(textProp).replace(/\n/g, '<div class="line-break"></div>');
  });

  return { formattedText };
}
