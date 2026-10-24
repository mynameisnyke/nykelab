<template>
  <section class="space-y-8">
    <div class="flex items-center gap-3">
      <label class="text-xs uppercase tracking-wider text-white/50">Range</label>
      <select v-model.number="days" class="field" @change="load">
        <option :value="1">24 hours</option>
        <option :value="7">7 days</option>
        <option :value="30">30 days</option>
        <option :value="90">90 days</option>
      </select>
    </div>

    <p v-if="loading" class="text-sm text-white/40">Loading…</p>
    <div v-else-if="stats && !stats.configured" class="text-sm text-white/60 max-w-xl space-y-2">
      <p>
        Stats are collected, but the dashboard can't read them yet. Set <code>CF_ACCOUNT_ID</code> in
        <code>wrangler.jsonc</code> and add an API token (Account Analytics: Read) as the <code>CF_API_TOKEN</code>
        secret. See the README.
      </p>
    </div>
    <p v-else-if="stats?.error" class="text-sm text-red-400">{{ stats.error }}</p>

    <template v-else-if="stats">
      <div v-if="stats.daily?.length">
        <h3 class="h">Page views per day</h3>
        <div class="flex items-end gap-1 h-24">
          <div
            v-for="d in stats.daily"
            :key="d.day"
            class="flex-1 bg-white/60 min-w-[3px]"
            :style="{ height: `${Math.max(4, (d.views / maxDaily) * 100)}%` }"
            :title="`${d.day.slice(0, 10)}: ${d.views}`"
          ></div>
        </div>
      </div>

      <div class="grid gap-8 lg:grid-cols-2">
        <div>
          <h3 class="h">Top pages</h3>
          <table class="tbl">
            <tr v-for="p in stats.pages" :key="p.path">
              <td>{{ p.path }}</td>
              <td class="num">{{ p.views }}</td>
            </tr>
            <tr v-if="!stats.pages?.length"><td class="text-white/40">No data yet</td></tr>
          </table>
        </div>

        <div>
          <h3 class="h">Most viewed media</h3>
          <ul class="space-y-2">
            <li v-for="m in stats.media" :key="m.id" class="flex items-center gap-3 text-sm">
              <img v-if="byId[m.id]" :src="thumb(byId[m.id])" class="w-12 h-9 object-cover bg-white/10" />
              <div v-else class="w-12 h-9 bg-white/5"></div>
              <span class="flex-1 truncate">{{ label(m.id) }}</span>
              <span class="num">{{ m.views }}</span>
            </li>
            <li v-if="!stats.media?.length" class="text-sm text-white/40">No data yet</li>
          </ul>
        </div>
      </div>

      <div v-if="stats.plays?.length">
        <h3 class="h">Videos</h3>
        <table class="tbl">
          <tr class="text-white/40 text-xs"><td>Video</td><td class="num">Plays</td><td class="num">Completions</td></tr>
          <tr v-for="v in stats.plays" :key="v.id">
            <td>{{ label(v.id) }}</td>
            <td class="num">{{ v.plays }}</td>
            <td class="num">{{ v.completes }}</td>
          </tr>
        </table>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { admin, type ApiMedia, type StatsResponse } from "../../lib/api";
import { useToast } from "../../composables/useToast";

const props = defineProps<{ media: ApiMedia[] }>();
const { fail } = useToast();

const days = ref(7);
const loading = ref(true);
const stats = ref<StatsResponse | null>(null);

const byId = computed(() => Object.fromEntries(props.media.map((m) => [m.id, m])));
const maxDaily = computed(() => Math.max(1, ...(stats.value?.daily ?? []).map((d) => d.views)));
const thumb = (m: ApiMedia) => m.urls.small ?? m.urls.poster ?? m.urls.main;
const label = (id: string) => {
  const m = byId.value[id];
  return m ? m.caption.split("\n")[0] || m.place || `${m.collection} · ${id}` : `(deleted) ${id}`;
};

async function load() {
  loading.value = true;
  try {
    stats.value = await admin.stats(days.value);
  } catch (err) {
    fail(err);
  } finally {
    loading.value = false;
  }
}
onMounted(load);
</script>

<style scoped>
.field {
  background: #111;
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #fff;
  padding: 0.35rem 0.5rem;
  font-size: 0.875rem;
}
.h {
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 0.75rem;
}
.tbl {
  width: 100%;
  font-size: 0.875rem;
}
.tbl td {
  padding: 0.3rem 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.num {
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: rgba(255, 255, 255, 0.8);
}
</style>
