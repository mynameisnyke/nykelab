import { onMounted, onUnmounted, Ref } from "vue";
import { gsap } from "gsap";

export function useScrollFade(elementRef: Ref<HTMLElement | null>) {
  const checkScroll = () => {
    if (!elementRef.value) {
      return;
    }

    const triggerHeight = window.innerHeight / 4;
    const currentPosition = window.scrollY;

    if (currentPosition > triggerHeight) {
      gsap.to(elementRef.value, { opacity: 0, duration: 0.5 });
    } else {
      gsap.to(elementRef.value, { opacity: 1, duration: 0.5 });
    }
  };

  onMounted(() => {
    window.addEventListener("scroll", checkScroll);
    checkScroll(); // Initial check
  });

  onUnmounted(() => {
    window.removeEventListener("scroll", checkScroll);
  });
}
