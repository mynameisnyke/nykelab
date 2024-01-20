import {  onMounted, onUnmounted} from "vue";

export function useNoScroll() {
    const noScrollClass = 'no-scroll';

    onMounted(() => {
      document.body.classList.add(noScrollClass);
    });
    
    onUnmounted(() => {
      document.body.classList.remove(noScrollClass)
})
}
