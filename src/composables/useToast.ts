import { ref } from "vue";

const message = ref("");
const kind = ref<"info" | "error">("info");
let timer: ReturnType<typeof setTimeout> | null = null;

export function useToast() {
  const show = (text: string, k: "info" | "error" = "info") => {
    message.value = text;
    kind.value = k;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => (message.value = ""), k === "error" ? 6000 : 2500);
  };
  const fail = (err: unknown) => show(err instanceof Error ? err.message : String(err), "error");
  return { message, kind, show, fail };
}
