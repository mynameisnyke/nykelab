<template>
  <section class="space-y-6 max-w-xl">
    <form class="flex gap-2" @submit.prevent="create">
      <input v-model="title" placeholder="New collection (e.g. Norway)" class="field flex-1" maxlength="80" />
      <button class="btn" :disabled="!title.trim()">Add</button>
    </form>
    <p class="text-xs text-white/40">
      A collection is a page on the site at <code>/{name}</code>. Empty or unpublished collections don't appear in the
      navigation.
    </p>

    <ul class="divide-y divide-white/10 border border-white/15">
      <li v-for="(c, i) in collections" :key="c.slug" class="flex items-center gap-3 p-3">
        <input
          :value="c.title"
          class="field flex-1"
          maxlength="80"
          @change="rename(c, ($event.target as HTMLInputElement).value)"
        />
        <span class="text-xs text-white/40 w-16 text-right">{{ c.count }} items</span>
        <label class="flex items-center gap-1 text-xs text-white/70">
          <input type="checkbox" :checked="c.published" @change="publish(c, $event)" /> Live
        </label>
        <button class="btn" :disabled="i === 0" @click="shift(i, -1)" aria-label="Move up">↑</button>
        <button class="btn" :disabled="i === collections.length - 1" @click="shift(i, 1)" aria-label="Move down">↓</button>
        <button class="btn btn--danger" @click="remove(c)">Delete</button>
      </li>
      <li v-if="!collections.length" class="p-4 text-sm text-white/40">No collections yet.</li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { admin, type AdminCollection } from "../../lib/api";
import { useToast } from "../../composables/useToast";

const props = defineProps<{ collections: AdminCollection[] }>();
const emit = defineEmits<{ (e: "changed"): void }>();
const { show, fail } = useToast();
const title = ref("");

async function run(fn: () => Promise<unknown>, ok?: string) {
  try {
    await fn();
    if (ok) show(ok);
    emit("changed");
  } catch (err) {
    fail(err);
  }
}

const create = () =>
  run(async () => {
    await admin.createCollection(title.value);
    title.value = "";
  }, "Collection created");
const rename = (c: AdminCollection, value: string) => {
  if (value.trim() && value.trim() !== c.title) run(() => admin.updateCollection(c.slug, { title: value }), "Renamed");
};
const publish = (c: AdminCollection, e: Event) =>
  run(() => admin.updateCollection(c.slug, { published: (e.target as HTMLInputElement).checked }));
const remove = (c: AdminCollection) => {
  if (!confirm(`Delete "${c.title}"? (Only possible when it has no media.)`)) return;
  run(() => admin.deleteCollection(c.slug), "Deleted");
};
const shift = (i: number, dir: -1 | 1) => {
  const slugs = props.collections.map((c) => c.slug);
  [slugs[i], slugs[i + dir]] = [slugs[i + dir], slugs[i]];
  run(() => admin.orderCollections(slugs));
};
</script>

<style scoped>
.field {
  background: #111;
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #fff;
  padding: 0.35rem 0.5rem;
  font-size: 0.875rem;
}
.btn {
  border: 1px solid rgba(255, 255, 255, 0.25);
  padding: 0.3rem 0.7rem;
  font-size: 0.75rem;
}
.btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
}
.btn:disabled {
  opacity: 0.3;
}
.btn--danger:hover {
  background: rgba(255, 60, 60, 0.25) !important;
}
</style>
