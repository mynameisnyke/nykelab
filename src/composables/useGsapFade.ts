import { Ref, onMounted, onUnmounted } from "vue";
import { gsap } from "gsap";

export function useGsapFade(
  elementRef: Ref<HTMLElement | null>,
  enableFade: boolean,
  duration = 1.2
) {
  let observer: IntersectionObserver;

  const animateIn = (element: Element) => {
    gsap.to(element, {
      opacity: 1,
      duration: duration,
      ease: "power2.inOut",
    });
  };

  const animateOut = (element: Element) => {
    gsap.to(element, {
      opacity: 0,
      duration: duration,
      ease: "power2.inOut",
    });
  };

  onMounted(() => {
    if (enableFade && elementRef.value) {
      // Set initial opacity to 0
      gsap.set(elementRef.value, { opacity: 0 });

      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              animateIn(entry.target);
            } else {
              animateOut(entry.target);
            }
          });
        },
        { threshold: 0.1 }
      );

      observer.observe(elementRef.value);

      // Trigger animation immediately if the element is already in the viewport
      if (elementRef.value.getBoundingClientRect().top < window.innerHeight) {
        animateIn(elementRef.value);
      }
    }
  });

  onUnmounted(() => {
    if (observer && elementRef.value) {
      observer.unobserve(elementRef.value);
    }
  });
}
