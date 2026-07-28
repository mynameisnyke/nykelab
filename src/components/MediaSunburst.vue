<!-- MediaSunburst.vue -->
<template>
  <div ref="mediaNav" :class="['media-sunburst', { 'opacity-0': enableFade }]">
    <div class="chart-stage" :style="stageStyle">
      <div class="chart-container"></div>
      <button
        class="chart-center"
        :style="centerStyle"
        @click="resetToRoot"
        :aria-label="selectedPath.length ? 'Back to all' : 'View all'"
      ></button>
    </div>

    <transition name="caption-fade" mode="out-in">
      <div :key="activeLabel || 'idle'" class="chart-caption">
        <template v-if="activeLabel">
          <span class="chart-caption-index">{{ activeIndex }}</span>
          <span class="chart-caption-name">{{ activeLabel }}</span>
        </template>
        <template v-else>
          <span class="chart-caption-hint">Tap a section to explore</span>
        </template>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, PropType } from "vue";
import * as d3 from "d3";

interface MediaItem {
  name: string;
  size?: number;
  children?: MediaItem[];
}

interface ExtendedHierarchyNode extends d3.HierarchyRectangularNode<MediaItem> {}

const props = defineProps({
  data: {
    type: Object as PropType<MediaItem>,
    required: true,
  },
  enableFade: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["navigate"]);
const mediaNav = ref<HTMLElement | null>(null);

// Sizing — kept intentionally compact so the chart reads as a
// navigation element, not the hero of the page.
const chartSize = ref(280);
const centerSize = ref(70);

const stageStyle = computed(() => ({
  width: `${chartSize.value}px`,
  height: `${chartSize.value}px`,
}));
const centerStyle = computed(() => ({
  width: `${centerSize.value}px`,
  height: `${centerSize.value}px`,
}));

// Reactive caption driven by hover/selection instead of cramped in-arc text
const hoveredPath = ref<string[] | null>(null);
const selectedPath = ref<string[]>([]);
const activePath = computed(() => hoveredPath.value ?? selectedPath.value);
const activeLabel = computed(() => {
  const path = activePath.value;
  return path.length ? path[path.length - 1] : "";
});
const activeIndex = computed(() =>
  String(activePath.value.length).padStart(2, "0")
);

const getPathToNode = (node: ExtendedHierarchyNode): string[] => {
  const path: string[] = [];
  let current: d3.HierarchyNode<MediaItem> | null = node;
  while (current?.parent) {
    path.unshift(current.data.name);
    current = current.parent;
  }
  return path;
};

const resetToRoot = () => {
  selectedPath.value = [];
  hoveredPath.value = null;
  emit("navigate", []);
};

const createChart = () => {
  if (!mediaNav.value) return;

  const isMobile = window.innerWidth < 640;
  const containerWidth = mediaNav.value.clientWidth || chartSize.value;
  const maxSize = isMobile ? 240 : 300;
  const width = Math.min(containerWidth, maxSize);
  const radius = width / 2;

  chartSize.value = width;

  const container = d3.select(mediaNav.value).select(".chart-container");
  container.selectAll("*").remove();

  const svg = container
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${width}`)
    .attr("width", "100%")
    .attr("height", "100%")
    .append("g")
    .attr("transform", `translate(${width / 2},${width / 2})`);

  const root = d3
    .hierarchy<MediaItem>(props.data)
    .sum((d) => d.size || 0)
    .sort((a, b) => (b.value || 0) - (a.value || 0));

  // The partition layout divides the radius evenly across root.height + 1
  // rings — size the center button to that inner hole, not an arbitrary
  // fraction, or it overlaps the first ring of arcs.
  const holeRadius = radius / (root.height + 1);
  centerSize.value = Math.round(holeRadius * 2 * 0.7);

  const partition = d3.partition<MediaItem>().size([2 * Math.PI, radius]);
  const rootWithLayout = partition(root) as unknown as ExtendedHierarchyNode;

  const arc = d3
    .arc<d3.HierarchyRectangularNode<MediaItem>>()
    .startAngle((d) => d.x0)
    .endAngle((d) => d.x1)
    .innerRadius((d) => d.y0)
    .outerRadius((d) => d.y1)
    .cornerRadius(2);

  const nodes = rootWithLayout.descendants().filter((d) => d.depth > 0);
  const baseFill = (d: ExtendedHierarchyNode) =>
    d.depth === 1 ? "rgba(255, 255, 255, 0.24)" : "rgba(255, 255, 255, 0.09)";

  svg
    .selectAll("path")
    .data(nodes)
    .enter()
    .append("path")
    .attr("d", (d) => arc(d as d3.HierarchyRectangularNode<MediaItem>))
    .style("fill", baseFill)
    .style("stroke", "#000")
    .style("stroke-width", "2px")
    .style("cursor", "pointer")
    .style("transition", "fill 0.25s ease")
    .on("mouseenter", function (_event, d: ExtendedHierarchyNode) {
      hoveredPath.value = getPathToNode(d);
      d3.select(this)
        .style("fill", "rgba(255, 255, 255, 0.85)")
        .transition()
        .duration(250)
        .ease(d3.easeCubicOut)
        .attr("transform", () => {
          const c = arc.centroid(d as d3.HierarchyRectangularNode<MediaItem>);
          return `translate(${c[0] * 0.04},${c[1] * 0.04})`;
        });
    })
    .on("mouseleave", function (_event, d: ExtendedHierarchyNode) {
      hoveredPath.value = null;
      d3.select(this)
        .style("fill", baseFill(d))
        .transition()
        .duration(250)
        .ease(d3.easeCubicInOut)
        .attr("transform", "translate(0,0)");
    })
    .on("click", (_event, d: ExtendedHierarchyNode) => {
      const path = getPathToNode(d);
      selectedPath.value = path;
      emit("navigate", path);
    });

  // Hairline ring around the outer edge for a drawn, editorial finish
  svg
    .append("circle")
    .attr("r", radius - 1)
    .attr("fill", "none")
    .attr("stroke", "rgba(255,255,255,0.15)")
    .attr("stroke-width", "1px");
};

onMounted(() => {
  if (props.enableFade) {
    setTimeout(() => {
      mediaNav.value?.classList.remove("opacity-0");
      createChart();
    }, 300);
  } else {
    createChart();
  }
  window.addEventListener("resize", createChart);
});

onUnmounted(() => {
  window.removeEventListener("resize", createChart);
});

watch(() => props.data, createChart, { deep: true });
</script>

<style scoped>
.media-sunburst {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  transition: opacity 0.4s ease, transform 0.4s ease;
}

.chart-stage {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.chart-container {
  width: 100%;
  height: 100%;
}

.chart-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  border-radius: 9999px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  transition: background-color 0.25s ease, border-color 0.25s ease;
}

.chart-center:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.35);
}

.chart-caption {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  min-height: 1.5em;
}

.chart-caption-hint {
  font-family: "Arial", sans-serif;
  font-weight: 400;
  font-size: 0.8rem;
  letter-spacing: 0.02em;
  color: rgba(255, 255, 255, 0.35);
}

.chart-caption-index {
  font-family: "Arial", sans-serif;
  font-weight: 700;
  font-size: 0.75rem;
  letter-spacing: 0.02em;
  color: rgba(255, 255, 255, 0.5);
}

.chart-caption-name {
  font-family: "Arial", sans-serif;
  font-weight: 700;
  font-size: 0.9rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.9);
}

.caption-fade-enter-active,
.caption-fade-leave-active {
  transition: opacity 0.2s ease;
}
.caption-fade-enter-from,
.caption-fade-leave-to {
  opacity: 0;
}

.opacity-0 {
  opacity: 0;
  transform: scale(0.97);
}
</style>
