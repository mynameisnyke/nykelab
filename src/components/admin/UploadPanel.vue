<template>
  <section class="rounded border border-white/15 p-4">
    <div class="flex flex-wrap items-center gap-3 mb-3">
      <label class="text-xs uppercase tracking-wider text-white/50">Upload to</label>
      <select v-model="target" class="field">
        <option v-for="c in collections" :key="c.slug" :value="c.slug">{{ c.title }}</option>
      </select>
      <label class="flex items-center gap-2 text-sm text-white/70">
        <input type="checkbox" v-model="publishNow" /> Publish immediately
      </label>
    </div>

    <div
      class="drop"
      :class="{ 'drop--over': dragging, 'drop--disabled': !target }"
      @dragover.prevent="dragging = true"
      @dragleave.prevent="dragging = false"
      @drop.prevent="onDrop"
      @click="target && picker?.click()"
    >
      <span v-if="!collections.length">Create a collection first (Collections tab).</span>
      <span v-else>Drop photos or videos here, or click to choose</span>
      <input
        ref="picker"
        type="file"
        multiple
        accept="image/*,video/mp4,video/webm"
        class="hidden"
        @change="onPick"
      />
    </div>
    <p class="mt-2 text-xs text-white/40">
      Photos are resized in your browser to WebP. Videos: MP4 (H.264) or WebM, up to 100&nbsp;MB — compress
      longer clips first.
    </p>

    <ul v-if="queue.length" class="mt-4 space-y-2">
      <li v-for="q in queue" :key="q.key" class="text-sm">
        <div class="flex justify-between gap-4">
          <span class="truncate">{{ q.name }}</span>
          <span :class="q.status === 'error' ? 'text-red-400' : 'text-white/50'">
            {{ q.status === "error" ? q.error : q.status }}
          </span>
        </div>
        <div v-if="q.status === 'uploading' || q.status === 'preparing'" class="h-0.5 bg-white/10 mt-1">
          <div class="h-full bg-white/70 transition-all" :style="{ width: `${q.progress * 100}%` }"></div>
        </div>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from "vue";
import { admin, type AdminCollection } from "../../lib/api";
import { newMediaId, prepareImage, prepareVideo } from "../../lib/imageVariants";
import { useToast } from "../../composables/useToast";

const props = defineProps<{ collections: AdminCollection[]; selected: string }>();
const emit = defineEmits<{ (e: "uploaded"): void }>();

interface QueueItem {
  key: number;
  name: string;
  status: "queued" | "preparing" | "uploading" | "saving" | "done" | "error";
  progress: number;
  error?: string;
}

const { fail } = useToast();
const picker = ref<HTMLInputElement | null>(null);
const dragging = ref(false);
const publishNow = ref(true);
const target = ref(props.selected || props.collections[0]?.slug || "");
const queue = reactive<QueueItem[]>([]);
let counter = 0;
let running = false;

watch(
  () => [props.selected, props.collections] as const,
  ([sel, cols]) => {
    if (sel) target.value = sel;
    else if (!cols.some((c) => c.slug === target.value)) target.value = cols[0]?.slug ?? "";
  },
);

const pending: { item: QueueItem; file: File; collection: string }[] = [];

function enqueue(files: FileList | File[]) {
  if (!target.value) return;
  for (const file of Array.from(files)) {
    const item = reactive<QueueItem>({ key: counter++, name: file.name, status: "queued", progress: 0 });
    queue.unshift(item);
    pending.push({ item, file, collection: target.value });
  }
  drain();
}

const onPick = (e: Event) => {
  const input = e.target as HTMLInputElement;
  if (input.files) enqueue(input.files);
  input.value = "";
};
const onDrop = (e: DragEvent) => {
  dragging.value = false;
  if (e.dataTransfer?.files) enqueue(e.dataTransfer.files);
};

// One file at a time keeps memory sane when resizing large camera originals.
async function drain() {
  if (running) return;
  running = true;
  while (pending.length) {
    const job = pending.shift()!;
    try {
      await processOne(job.item, job.file, job.collection);
      job.item.status = "done";
      emit("uploaded");
    } catch (err) {
      job.item.status = "error";
      job.item.error = err instanceof Error ? err.message : String(err);
      fail(err);
    }
  }
  running = false;
}

async function processOne(item: QueueItem, file: File, collection: string) {
  const id = newMediaId();
  const isVideo = file.type.startsWith("video/");
  item.status = "preparing";
  item.progress = 0.05;

  const parts: { role: "main" | "small" | "poster"; blob: Blob }[] = [];
  let meta: { width: number; height: number; orientation: string };
  if (isVideo) {
    const v = await prepareVideo(file);
    parts.push({ role: "main", blob: file }, { role: "poster", blob: v.poster });
    meta = v;
  } else {
    const img = await prepareImage(file);
    parts.push({ role: "main", blob: img.main }, { role: "small", blob: img.small });
    meta = img;
  }

  item.status = "uploading";
  const total = parts.reduce((n, p) => n + p.blob.size, 0);
  let done = 0;
  const keys: Record<string, string> = {};
  for (const part of parts) {
    const res = await admin.upload(id, part.role, part.blob, (f) => {
      item.progress = (done + f * part.blob.size) / total;
    });
    keys[part.role] = res.key;
    done += part.blob.size;
  }

  item.status = "saving";
  await admin.createMedia({
    id,
    collection,
    type: isVideo ? "video" : "image",
    width: meta.width,
    height: meta.height,
    orientation: meta.orientation,
    published: publishNow.value,
    keys,
  });
}
</script>

<style scoped>
.field {
  background: #111;
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #fff;
  padding: 0.35rem 0.5rem;
  font-size: 0.875rem;
}
.drop {
  border: 1px dashed rgba(255, 255, 255, 0.25);
  padding: 2rem 1rem;
  text-align: center;
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.875rem;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
}
.drop--over {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.6);
}
.drop--disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
</style>
