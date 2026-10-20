<script setup>
/** Đường xu hướng nhỏ trong thẻ số liệu (không trục, không nhãn) */
import { computed } from 'vue'
const props = defineProps({
  values: { type: Array, required: true },
  color: { type: String, default: 'var(--primary)' },
  width: { type: Number, default: 96 },
  height: { type: Number, default: 32 },
})
const id = 'sp' + Math.random().toString(36).slice(2, 8)
const pts = computed(() => {
  const v = props.values.map((n) => +n || 0)
  const max = Math.max(...v, 1), min = Math.min(...v, 0)
  const span = max - min || 1, pad = 3
  return v.map((n, i) => [
    pad + (i / Math.max(1, v.length - 1)) * (props.width - pad * 2),
    pad + (1 - (n - min) / span) * (props.height - pad * 2),
  ])
})
const line = computed(() => pts.value.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' '))
const area = computed(() => {
  const p = pts.value
  return p.length ? `${line.value} L${p[p.length - 1][0]},${props.height} L${p[0][0]},${props.height} Z` : ''
})
const last = computed(() => pts.value[pts.value.length - 1])
</script>

<template>
  <svg class="spark" :width="width" :height="height" :viewBox="`0 0 ${width} ${height}`" aria-hidden="true">
    <defs>
      <linearGradient :id="id" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" :style="{ stopColor: color, stopOpacity: 0.2 }" />
        <stop offset="100%" :style="{ stopColor: color, stopOpacity: 0 }" />
      </linearGradient>
    </defs>
    <path :d="area" :fill="`url(#${id})`" />
    <path :d="line" fill="none" :style="{ stroke: color }" stroke-width="1.75" stroke-linejoin="round" stroke-linecap="round" />
    <circle v-if="last" :cx="last[0]" :cy="last[1]" r="2.5" :style="{ fill: color }" />
  </svg>
</template>

<style>
.spark { display: block; overflow: visible; }
</style>
