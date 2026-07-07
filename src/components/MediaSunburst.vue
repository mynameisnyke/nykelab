<template>
  <div ref="mediaNav" :class="['media-sunburst', { 'opacity-0': enableFade }]">
    <div class="chart-container">
      <!-- D3 will insert SVG here -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, PropType } from 'vue';
import * as d3 from 'd3';

// Define proper types for the hierarchy
interface MediaItem {
  name: string;
  size?: number;
  children?: MediaItem[];
}

interface ExtendedHierarchyNode extends d3.HierarchyRectangularNode<MediaItem> {
  // No need to declare x0, x1, y0, y1 as they're already in HierarchyRectangularNode
}

const props = defineProps({
  data: {
    type: Object as PropType<MediaItem>,
    required: true
  },
  enableFade: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['navigate']);
const mediaNav = ref<HTMLElement | null>(null);
const currentNode = ref<ExtendedHierarchyNode | null>(null);

// Function to get path to a node
const getPathToNode = (node: ExtendedHierarchyNode): string[] => {
  const path: string[] = [];
  let current: d3.HierarchyNode<MediaItem> | null = node;
  while (current?.parent) {
    path.unshift(current.data.name);
    current = current.parent;
  }
  return path;
};

// Update the color scheme with more refined NYT-inspired colors
const colorPalette = {
  primary: '#F0F0F0',    // Off-white instead of pure white
  accent1: '#D8D8D8',    // Lighter warm gray
  accent2: '#BDBDBD',    // Medium warm gray
  accent3: '#909090',    // Darker warm gray
  stroke: '#404040',     // Darker stroke for definition
  text: '#E0E0E0'        // Slightly dimmed text for better readability
};

// Update the color scale to be more subtle
const color = d3.scaleOrdinal<string>()
  .domain(["0", "1", "2", "3"])
  .range([
    colorPalette.primary,   // Outer ring - white
    colorPalette.accent1,   // Second ring
    colorPalette.accent2,   // Third ring
    colorPalette.accent3    // Inner sections
  ]);

// Create and update the chart
const createChart = () => {
  if (!mediaNav.value) return;
  
  // Clear previous chart
  d3.select(mediaNav.value).select('.chart-container').selectAll('*').remove();
  
  // Responsive dimensions with padding consideration
  const containerWidth = mediaNav.value.clientWidth - 40; // Account for padding
  const width = Math.min(containerWidth, window.innerHeight * 0.7);
  const height = width;
  const radius = width / 2;
  
  // Create SVG with viewBox for better scaling
  const svg = d3.select(mediaNav.value).select('.chart-container')
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('width', '100%')
    .attr('height', '100%')
    .append('g')
    .attr('transform', `translate(${width/2},${height/2})`);
  
  // Create partition layout
  const partition = d3.partition<MediaItem>()
    .size([2 * Math.PI, radius]);
  
  // Create hierarchy from data
  const root = d3.hierarchy<MediaItem>(props.data)
    .sum(d => d.size || 0)
    .sort((a, b) => (b.value || 0) - (a.value || 0));
  
  // Apply partition layout and cast to extended type
  const rootWithLayout = partition(root) as unknown as ExtendedHierarchyNode;
  
  // Create arc generator with proper typing
  const arc = d3.arc<d3.HierarchyRectangularNode<MediaItem>>()
    .startAngle(d => d.x0)
    .endAngle(d => d.x1)
    .innerRadius(d => d.y0)
    .outerRadius(d => d.y1);
  
  // Create segments
  const path = svg.selectAll('path')
    .data(rootWithLayout.descendants().filter(d => d.depth > 0))
    .enter()
    .append('path')
    .attr('d', d => arc(d as d3.HierarchyRectangularNode<MediaItem>))
    .style('fill', d => color(d.depth.toString()))
    .style('opacity', 0.95)
    .style('stroke', colorPalette.stroke)
    .style('stroke-width', '0.5px')
    .style('cursor', 'pointer')
    .style('transition', 'all 0.3s ease')
    .on('click', (event, d: ExtendedHierarchyNode) => {
      currentNode.value = d;
      const path = getPathToNode(d);
      emit('navigate', path);
      
      // Visual feedback for selection
      svg.selectAll('path')
        .style('opacity', 0.6)
        .style('stroke-width', '1px');
      
      d3.select(event.currentTarget)
        .style('opacity', 1)
        .style('stroke-width', '2px');
    })
    .on('mouseover', function(event, d: ExtendedHierarchyNode) {
      d3.select(this)
        .style('opacity', 1)
        .transition()
        .duration(300)
        .ease(d3.easeCubicOut)
        .attr('transform', () => {
          const centroid = arc.centroid(d);
          const x = centroid[0] * 0.05;
          const y = centroid[1] * 0.05;
          return `translate(${x},${y})`;
        });
    })
    .on('mouseout', function(event, d: ExtendedHierarchyNode) {
      d3.select(this)
        .transition()
        .duration(300)
        .ease(d3.easeCubicInOut)
        .attr('transform', 'translate(0,0)')
        .style('opacity', 0.95);
    });
  
  // Add labels with proper typing
  const text = svg.selectAll('text')
    .data(rootWithLayout.descendants().filter(d => d.depth && (d.y1 - d.y0) * radius > 30))
    .enter()
    .append('text')
    .attr('transform', (d: ExtendedHierarchyNode) => {
      const x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
      const y = (d.y0 + d.y1) / 2;
      return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
    })
    .attr('dy', '0.35em')
    .attr('text-anchor', 'middle')
    .attr('fill', colorPalette.text)
    .attr('font-size', d => d.depth > 2 ? '12px' : '14px')
    .attr('font-family', '"Libre Baskerville", "Georgia", serif') // More NYT-like serif font
    .attr('font-weight', '400')
    .attr('letter-spacing', '0.01em')
    .style('text-shadow', '0 1px 3px rgba(0,0,0,0.4)')
    .text(d => d.data.name);
  
  // Add center circle for returning to root
  svg.append('circle')
    .attr('r', radius * 0.12)
    .attr('fill', '#000000')
    .attr('stroke', colorPalette.primary)
    .attr('stroke-width', '0.5px')
    .attr('opacity', 1)
    .style('cursor', 'pointer')
    .style('transition', 'all 0.3s ease')
    .on('click', () => {
      currentNode.value = null;
      emit('navigate', []);
      
      // Reset all segments
      svg.selectAll('path')
        .style('opacity', 0.9)
        .style('stroke-width', '1px');
    })
    .on('mouseover', function() {
      d3.select(this)
        .attr('opacity', 1)
        .style('filter', 'drop-shadow(0 8px 12px rgba(0, 0, 0, 0.2))');
    })
    .on('mouseout', function() {
      d3.select(this).attr('opacity', 0.9);
    });
  
  // Add home icon or text to center
  svg.append('text')
    .attr('text-anchor', 'middle')
    .attr('dy', '0.35em')
    .attr('fill', colorPalette.text)
    .attr('font-size', '13px')
    .attr('font-family', '"Libre Baskerville", "Georgia", serif')
    .attr('font-weight', '400')
    .attr('letter-spacing', '0.02em')
    .text('Home');
};

// Initialize chart on mount
onMounted(() => {
  if (props.enableFade) {
    setTimeout(() => {
      if (mediaNav.value) {
        mediaNav.value.classList.remove('opacity-0');
      }
      createChart();
    }, 300);
  } else {
    createChart();
  }
  
  // Make chart responsive
  window.addEventListener('resize', createChart);
});

// Clean up event listener
onUnmounted(() => {
  window.removeEventListener('resize', createChart);
});

// Watch for data changes
watch(() => props.data, createChart, { deep: true });
</script>

<style scoped>
.media-sunburst {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0;
}

.chart-container {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  /* Remove the drop shadow filter */
}

.opacity-0 {
  opacity: 0;
  transform: scale(0.95);
}
</style> 