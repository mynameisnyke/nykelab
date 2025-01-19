<template>
  <div ref="icicleChart" id="icicleChart" :class="['icicle-chart', { 'opacity-0': enableFade }]"></div>
</template>

<script lang="ts">
import * as d3 from "d3";

export default {
  props: {
    data: Object,
    enableFade: {
      type: Boolean,
      default: false,
    },
    size: {
      type: Number,
      default: 500, // Default size if not provided
    },
  },
  mounted() {
    this.createIcicleChart(this.$props.size);
    if (this.enableFade) {
      this.$nextTick(() => {
        setTimeout(() => {
          (this.$refs.icicleChart as HTMLElement).classList.add("visible");
        }, 1000);
      });
    } else {
      (this.$refs.icicleChart as HTMLElement).classList.add("visible");
    }
  },
  methods: {
    handleLabelClick(label: string) {
      this.$router.push(`/gallery/${label.toLowerCase()}`);
    },
    createIcicleChart(size: number) {
      const svg = d3
        .select(this.$refs.icicleChart as HTMLElement)
        .append("svg")
        .attr("width", size)
        .attr("height", size);

      const root = d3
        .hierarchy(this.data)
        .sum((d: any) => d.size)
        .sort((a, b) => (b.value || 0) - (a.value || 0));

      const icicle = d3.partition<typeof this.data>().size([size, size]).padding(1)(root);

      const colorScale = d3.scaleSequential(d3.interpolateViridis)
        .domain([0, d3.max(icicle.descendants(), d => d.value) || 0]);

      const rects = svg
        .selectAll("rect")
        .data(icicle.descendants())
        .enter()
        .append("rect")
        .attr("x", (d: any) => d.x0)
        .attr("y", (d: any) => d.y0)
        .attr("width", (d: any) => Math.max(1, d.x1 - d.x0))
        .attr("height", (d: any) => d.y1 - d.y0)
        .attr("fill", (d: any) => colorScale(d.value || 0))
        .attr("stroke", "#000")
        .attr("stroke-width", "1")
        .attr("opacity", 0.8);

      rects
        .on("mouseover", function (event, d: any) {
          d3.select(this)
            .transition()
            .duration(300)
            .attr("opacity", 1)
            .attr("stroke-width", "2")
            .attr("stroke", "#fff");

          // Pulsating animation
          d3.select(this)
            .transition()
            .duration(500)
            .attr("transform", "scale(1.05)")
            .transition()
            .duration(500)
            .attr("transform", "scale(1)")
        })
        .on("mouseout", function (event, d: any) {
          d3.select(this)
            .interrupt() // Stop the pulsating animation
            .transition()
            .duration(300)
            .attr("opacity", 0.8)
            .attr("stroke-width", "1")
            .attr("stroke", "#000")
            .attr("transform", "scale(1)");
        })
        .on("click", (event, d: any) => {
          this.handleLabelClick(d.data.name);
        });

      d3.select(this.$refs.icicleChart as HTMLElement).style("pointer-events", "none");
      svg.selectAll("rect").style("pointer-events", "all");

      svg
        .selectAll("text")
        .data(icicle.descendants())
        .enter()
        .append("text")
        .attr("x", (d: any) => d.x0 + 5)
        .attr("y", (d: any) => (d.y0 + d.y1) / 2)
        .text((d: any) => d.data.name)
        .attr("font-size", "10px")
        .attr("fill", "#fff")
        .attr("pointer-events", "none");
    },
  },
};
</script>

<style scoped>
.icicle-chart {
  transition: opacity 1.2s ease-in-out;
  background-color: #000;
}

.icicle-chart.visible {
  opacity: 1;
}

.opacity-0 {
  opacity: 0;
}
</style>
