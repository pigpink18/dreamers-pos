<script setup>
/**
 * Biểu đồ đường / vùng (SVG thuần) — có đường dò dọc + tooltip khi rê chuột.
 * labels: ['6h', '7h', …]   full: nhãn đầy đủ cho tooltip (tuỳ chọn)
 * series: [{ key, label, values: [number|null], color, dashed?, area? }]
 *   - null = chưa có dữ liệu (VD giờ chưa tới) → đường dừng lại
 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { money, moneyShort } from '../../utils/format'

const props = defineProps({
  labels: { type: Array, required: true },
  full: { type: Array, default: null },
  series: { type: Array, required: true },
  height: { type: Number, default: 220 },
  format: { type: Function, default: money },
  axisFormat: { type: Function, default: moneyShort },
  ticks: { type: Number, default: 4 },
})

const el = ref(null)
const width = ref(600)
let ro
onMounted(() => { ro = new ResizeObserver(([e]) => (width.value = e.contentRect.width)); ro.observe(el.value) })
onBeforeUnmount(() => ro?.disconnect())

const M = { top: 10, right: 12, bottom: 26, left: 44 }
const plotW = computed(() => Math.max(10, width.value - M.left - M.right))
const plotH = computed(() => props.height - M.top - M.bottom)
const n = computed(() => props.labels.length)

// Trục Y tròn số 1/2/2.5/5 × 10^n
const yTicks = computed(() => {
  const max = Math.max(1000000, ...props.series.flatMap((s) => s.values.filter((v) => v != null)))
  const raw = max / props.ticks
  const p = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw)
  const out = [0]
  while (out[out.length - 1] < max) out.push(+(out.length * step).toFixed(6))
  return out
})
const yMax = computed(() => yTicks.value[yTicks.value.length - 1] || 1)
const x = (i) => M.left + (n.value <= 1 ? plotW.value / 2 : (i / (n.value - 1)) * plotW.value)
const y = (v) => M.top + plotH.value - (v / yMax.value) * plotH.value

// Đường cong mượt kiểu "monotone" — không vọt quá điểm dữ liệu
function smooth(pts) {
  if (pts.length < 2) return pts.length ? `M${pts[0][0]},${pts[0][1]}` : ''
  const d = [], m = []
  for (let i = 0; i < pts.length - 1; i++) d.push((pts[i + 1][1] - pts[i][1]) / (pts[i + 1][0] - pts[i][0]))
  m.push(d[0])
  for (let i = 1; i < pts.length - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2)
  m.push(d[d.length - 1])
  for (let i = 0; i < d.length; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i] }
  }
  let path = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], h = (x1 - x0) / 3
    path += ` C${x0 + h},${y0 + m[i] * h} ${x1 - h},${y1 - m[i + 1] * h} ${x1},${y1}`
  }
  return path
}

const lines = computed(() =>
  props.series.map((s, si) => {
    const pts = s.values.map((v, i) => (v == null ? null : [x(i), y(v)])).filter(Boolean)
    const line = smooth(pts)
    const area = s.area && pts.length > 1 ? `${line} L${pts[pts.length - 1][0]},${y(0)} L${pts[0][0]},${y(0)} Z` : ''
    const last = pts[pts.length - 1]
    return { ...s, id: `g${si}-${Math.random().toString(36).slice(2, 7)}`, line, area, last }
  })
)
const labelEvery = computed(() => Math.max(1, Math.ceil(n.value / Math.max(1, Math.floor(plotW.value / 46)))))

// ---- Rê chuột: chọn điểm gần nhất theo trục X ----
const hover = ref(null)
function onMove(e) {
  const r = el.value.getBoundingClientRect()
  const px = e.clientX - r.left - M.left
  hover.value = Math.max(0, Math.min(n.value - 1, Math.round((px / plotW.value) * (n.value - 1))))
}
const tip = computed(() => {
  if (hover.value === null) return null
  const i = hover.value
  const rows = props.series.map((s) => ({ ...s, v: s.values[i] })).filter((r) => r.v != null)
  if (!rows.length) return null
  const cx = x(i)
  const right = cx < width.value - 200 // tooltip nằm bên phải đường dò, sát mép thì lật sang trái
  return { i, cx, rows, right, title: props.full?.[i] || props.labels[i] }
})
</script>

<template>
  <div class="trend" ref="el" @pointermove="onMove" @pointerleave="hover = null">
    <svg :width="width" :height="height" role="img" :aria-label="series.map((s) => s.label).join(', ')">
      <defs>
        <linearGradient v-for="l in lines" :key="l.id" :id="l.id" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" :style="{ stopColor: l.color, stopOpacity: 0.22 }" />
          <stop offset="100%" :style="{ stopColor: l.color, stopOpacity: 0 }" />
        </linearGradient>
      </defs>
      <!-- lưới ngang rất nhạt -->
      <g v-for="t in yTicks" :key="t">
        <line :x1="M.left" :x2="width - M.right" :y1="y(t)" :y2="y(t)" class="trend__grid" :class="{ base: t === 0 }" />
        <text :x="M.left - 8" :y="y(t) + 4" text-anchor="end" class="trend__axis">{{ axisFormat(t) }}</text>
      </g>
      <template v-for="(lb, i) in labels" :key="i">
        <text v-if="i % labelEvery === 0" :x="x(i)" :y="height - 6" text-anchor="middle" class="trend__axis">{{ lb }}</text>
      </template>
      <!-- vùng + đường -->
      <path v-for="l in lines" :key="l.id + 'a'" v-show="l.area" :d="l.area" :fill="`url(#${l.id})`" class="trend__area" />
      <path v-for="l in lines" :key="l.id + 'l'" :d="l.line" class="trend__line" :class="{ dashed: l.dashed }" :style="{ stroke: l.color }" />
      <!-- điểm cuối của đường chính (VD: "bây giờ") -->
      <template v-for="l in lines" :key="l.id + 'p'">
        <circle v-if="l.last && !l.dashed && hover === null" :cx="l.last[0]" :cy="l.last[1]" r="4.5" class="trend__dot" :style="{ fill: l.color }" />
      </template>
      <!-- đường dò -->
      <g v-if="tip">
        <line :x1="tip.cx" :x2="tip.cx" :y1="M.top" :y2="y(0)" class="trend__cross" />
        <circle v-for="r in tip.rows" :key="r.key" :cx="tip.cx" :cy="y(r.v)" r="4.5" class="trend__dot" :style="{ fill: r.color }" />
      </g>
    </svg>

    <div v-if="tip" class="chart-tip" :class="tip.right ? 'is-right' : 'is-left'" :style="{ left: tip.cx + 'px', top: M.top + 'px' }">
      <div class="chart-tip__title">{{ tip.title }}</div>
      <div v-for="r in tip.rows" :key="r.key" class="chart-tip__row">
        <i :class="{ dashed: r.dashed }" :style="{ background: r.dashed ? 'none' : r.color, borderColor: r.color }"></i>{{ r.label }}<b class="num">{{ format(r.v) }}</b>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
@use '../../styles/tokens' as *;
.trend {
  position: relative; width: 100%; touch-action: pan-y;
  svg { display: block; overflow: visible; }
  &__grid { stroke: var(--border); stroke-width: 1; &.base { stroke: var(--border-strong); } }
  &__axis { font-size: 11px; fill: $text-muted; font-variant-numeric: tabular-nums; }
  &__line { fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; &.dashed { stroke-dasharray: 4 4; stroke-width: 1.5; opacity: .7; } }
  &__cross { stroke: var(--border-strong); stroke-width: 1; }
  &__dot { stroke: var(--surface); stroke-width: 2; }
  [data-motion='full'] &__line:not(.dashed) { stroke-dasharray: 2000; stroke-dashoffset: 2000; animation: drawLine 1.1s $ease-out forwards; }
  [data-motion='full'] &__area { opacity: 0; animation: fadeArea .8s .35s $ease-out forwards; }
}
@keyframes drawLine { to { stroke-dashoffset: 0; } }
@keyframes fadeArea { to { opacity: 1; } }

</style>
