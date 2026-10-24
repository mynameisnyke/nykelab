import { computed, ref } from "vue";
import { getCollections, type CollectionSummary } from "../lib/api";

export interface NavItem {
  number: string;
  label: string;
  link: string;
}

// Module-level so every view shares one fetch.
const collections = ref<CollectionSummary[]>([]);
const featuredCount = ref(0);
const loaded = ref(false);
let inflight: Promise<void> | null = null;

export function loadCollections(force = false): Promise<void> {
  if (loaded.value && !force) return Promise.resolve();
  if (!inflight || force) {
    inflight = getCollections()
      .then((r) => {
        collections.value = r.collections;
        featuredCount.value = r.featuredCount;
        loaded.value = true;
      })
      .catch((err) => {
        console.error("Failed to load collections", err);
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function useCollections() {
  loadCollections();

  // Home + one entry per non-empty collection + World (if anything is featured).
  const navItems = computed<NavItem[]>(() => {
    const items: NavItem[] = [{ number: "0", label: "Home", link: "/" }];
    for (const c of collections.value) {
      if (c.images + c.videos > 0) {
        items.push({ number: String(items.length), label: c.title, link: `/${c.slug}` });
      }
    }
    if (featuredCount.value > 0) {
      items.push({ number: String(items.length), label: "World", link: "/world" });
    }
    return items;
  });

  return { collections, featuredCount, loaded, navItems };
}
