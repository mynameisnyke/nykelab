<template>
  <div ref="icicleChart" class="icicle-chart opacity-0"></div>
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
      // TODO FIX HARDCODED DELAY
      // Delay the fade effect by one second
      this.$nextTick(() => {
        setTimeout(() => {
          this.$refs.icicleChart.classList.add("visible");
        }, 1);
      });
    }
  },
  methods: {
    handleLabelClick(label) {
      // Use Vue router to navigate
      this.$router.push(`/gallery/${label}`);
    },
    createIcicleChart(size) {
      const svg = d3
        .select(this.$refs.icicleChart)
        .append("svg")
        .attr("width", size)
        .attr("height", size);

      // Create a root node from the data
      const root = d3
        .hierarchy(this.data)
        .sum((d) => d.size) // Define how to calculate the size of each node
        .sort((a, b) => b.value - a.value);

      // Create an icicle layout
      const icicle = d3.partition().size([size, size]).padding(1)(root);

      // Add rectangles for each node
      const rects = svg
        .selectAll("rect")
        .data(icicle.descendants())
        .enter()
        .append("rect")
        .attr("x", (d) => d.x0)
        .attr("y", (d) => d.y0)
        .attr("width", (d) => Math.max(1, d.x1 - d.x0)) // Ensure a minimum width
        .attr("height", (d) => d.y1 - d.y0)
        .attr("fill", "none") // Initial fill color
        .attr("stroke", "#fff") // Stroke color
        .attr("stroke-width", "1"); // Increased stroke width for a bolder look

      // Hover effects
      rects
        .on("mouseover", function (event) {
          d3.select(event.currentTarget) // Ensure correct element selection
            .transition()
            .duration(10000) // Slow transition duration for a noticeable effect
            .ease(d3.easeCubicInOut) // Smooth easing function
            .attr("fill", "rgba(64, 224, 208, 0.7)"); // Teal with slight opacity
        })
        .on("mouseout", function (event) {
          d3.select(event.currentTarget)
            .transition()
            .duration(10000) // Consistent duration for fade out
            .attr("fill", "none");
        })
        .on("click", (event, d) => {
          this.handleLabelClick(d.data.name);
        });

      // Select the SVG container and disable pointer events
      d3.select(this.$refs.icicleChart).style("pointer-events", "none");

      // Enable pointer events on the child rectangles
      svg.selectAll("rect").style("pointer-events", "all");

      // Add labels (optional, can be customized as needed)
      svg
        .selectAll("text")
        .data(icicle.descendants())
        .enter()
        .append("text")
        .attr("x", (d) => d.x0 + 8) // Adjust label positions as needed
        .attr("y", (d) => (d.y0 + d.y1) / 2)
        .text((d) => d.data.name)
        .attr("font-size", "10px")
        .attr("fill", "white");
    },
  },
};
</script>

<style scoped>
.icicle-chart {
  transition: opacity 1.2s ease-in-out;
}

.icicle-chart.visible {
  opacity: 1;
}
</style>
