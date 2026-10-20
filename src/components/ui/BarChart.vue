<script setup>
/**
 * Biểu đồ cột chồng (stacked bar) vẽ bằng SVG thuần — không cần thư viện.
 * data:   [{ label, full, <seriesKey>: number, ... }]
 * series: [{ key, label, color }]
 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { money, moneyShort } from '../../utils/format'

const props = defineProps({
  data: { type: Array, required: true },
  series: { type: Array, required: true },
  height: { type: Number, default: 260 },
  legend: { type: Boolean, default: true },
  average: { type: Boolean, default: false }, // vẽ đường trung bình (nét đứt)
})

const el = ref(null)
const width = ref(600)
let ro
onMounted(() => {
  ro = new ResizeObserver(([e]) => (width.value = e.contentRect.width))
  ro.observe(el.value)
})
onBeforeUnmount(() => ro?.disconnect())

const M = { top: 12, right: 8, bottom: 28, left: 44 }
const plotW = computed(() => Math.max(10, width.value - M.left - M.right))
const plotH = computed(() => props.height - M.top - M.bottom)

const totals = computed(() => props.data.map((d) => props.series.reduce((s, x) => s + (d[x.key] || 0), 0)))

// Trục Y "đẹp": làm tròn max lên 1/2/5 × 10^n
const ticks = computed(() => {
  const max = Math.max(...totals.value, 1000000) // chưa có doanh thu -> trục 0 → 1 tr thay vì 0 → 1 ₫
  const raw = max / 4
  const p = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw)
  const out = [0]
  while (out[out.length - 1] < max || out.length < 2) out.push(+(out.length * step).toFixed(6))
  return out
})
const yMax = computed(() => ticks.value[ticks.value.length - 1])
const y = (v) => M.top + plotH.value - (v / yMax.value) * plotH.value

const band = computed(() => plotW.value / props.data.length)
const barW = computed(() => Math.max(3, Math.min(22, band.value * 0.5)))
// Hiển thị nhãn trục X thưa ra khi có nhiều cột
const labelEvery = computed(() => Math.ceil(props.data.length / Math.max(1, Math.floor(plotW.value / 34))))

const bars = computed(() =>
  props.data.map((d, i) => {
    const cx = M.left + band.value * i + band.value / 2
    let acc = 0
    const segs = []
    props.series.forEach((s) => {
      const v = d[s.key] || 0
      if (v <= 0) return
      const y1 = y(acc), y2 = y(acc + v)
      // khe 2px giữa các đoạn chồng
      segs.push({ key: s.key, color: s.color, x: cx - barW.value / 2, y: y2, h: Math.max(0, y1 - y2 - (acc > 0 ? 2 : 0)) })
      acc += v
    })
    if (segs.length) segs[segs.length - 1].top = true
    return { i, cx, segs, d, total: totals.value[i] }
  })
)

// Đường bo tròn 4px ở đầu cột trên cùng, đáy vuông bám trục
function segPath(s) {
  const r = s.top ? Math.min(4, s.h, barW.value / 2) : 0
  const { x, y: t, h } = s, w = barW.value, b = t + h
  return `M${x},${b} V${t + r} Q${x},${t} ${x + r},${t} H${x + w - r} Q${x + w},${t} ${x + w},${t + r} V${b} Z`
}

const avg = computed(() => (totals.value.length ? totals.value.reduce((a, b) => a + b, 0) / totals.value.length : 0))

const hover = ref(null)
// Tooltip đặt cạnh cột (không che tiêu đề card), sát mép phải thì lật sang trái
const tip = computed(() => {
  if (hover.value === null) return null
  const b = bars.value[hover.value]
  return { b, left: b.cx + (b.cx < width.value - 220 ? band.value / 2 : -band.value / 2), right: b.cx < width.value - 220 }
})
</script>

<template>
  <div class="barchart" ref="el" @mouseleave="hover = null">
    <div class="barchart__legend" v-if="legend && series.length > 1">
      <span v-for="s in series" :key="s.key"><i :style="{ background: s.color }"></i>{{ s.label }}</span>
      <span v-if="average" class="barchart__avg-key"><i></i>Trung bình {{ moneyShort(avg) }}</span>
    </div>
    <svg :width="width" :height="height" role="img" aria-label="Biểu đồ doanh thu">
      <!-- lưới ngang rất nhạt -->
      <g v-for="t in ticks" :key="t">
        <line :x1="M.left" :x2="width - M.right" :y1="y(t)" :y2="y(t)" class="grid" :class="{ base: t === 0 }" />
        <text :x="M.left - 8" :y="y(t) + 4" text-anchor="end" class="axis">{{ moneyShort(t) }}</text>
      </g>
      <!-- cột -->
      <g v-for="b in bars" :key="b.i" class="barchart__col" :class="{ dim: hover !== null && hover !== b.i }" :style="{ '--d': b.i * 28 + 'ms' }">
        <rect v-if="hover === b.i" :x="b.cx - band / 2 + 2" :y="M.top" :width="band - 4" :height="plotH" class="hoverband" rx="8" />
        <path v-for="s in b.segs" :key="s.key" :d="segPath(s)" :style="{ fill: s.color }" class="bar" />
        <text v-if="b.i % labelEvery === 0" :x="b.cx" :y="height - 8" text-anchor="middle" class="axis" :class="{ on: hover === b.i }">{{ b.d.label }}</text>
        <!-- vùng nhận chuột rộng hơn cột -->
        <rect :x="b.cx - band / 2" :y="M.top" :width="band" :height="plotH" fill="transparent" @mouseenter="hover = b.i" @touchstart.passive="hover = b.i" />
      </g>
      <!-- đường trung bình -->
      <g v-if="average && avg > 0" class="barchart__avg">
        <line :x1="M.left" :x2="width - M.right" :y1="y(avg)" :y2="y(avg)" />
      </g>
    </svg>

    <div v-if="tip" class="chart-tip" :class="tip.right ? 'is-right' : 'is-left'" :style="{ left: tip.left + 'px', top: M.top + 'px' }">
      <div class="chart-tip__title">{{ tip.b.d.full || tip.b.d.label }}</div>
      <div v-for="s in series" :key="s.key" class="chart-tip__row">
        <i :style="{ background: s.color, height: '10px', width: '10px', borderRadius: '3px' }"></i>{{ s.label }}<b class="num">{{ money(tip.b.d[s.key]) }}</b>
      </div>
      <div class="chart-tip__row total" v-if="series.length > 1">Tổng<b class="num">{{ money(tip.b.total) }}</b></div>
      <div class="chart-tip__row muted" v-if="tip.b.d.count !== undefined">{{ tip.b.d.count }} hoá đơn</div>
    </div>
  </div>
</template>

<style lang="scss">
@use '../../styles/tokens' as *;
.barchart {
  position: relative; width: 100%;
  svg { display: block; overflow: visible; }
  .grid { stroke: var(--border); stroke-width: 1; &.base { stroke: var(--border-strong); } }
  .axis { font-size: 11px; fill: $text-muted; font-variant-numeric: tabular-nums; transition: fill .15s; &.on { fill: $text; font-weight: 600; } }
  .hoverband { fill: var(--fill); }
  &__col { transition: opacity .2s; &.dim .bar { opacity: .45; } }
  .bar { transition: opacity .2s; }
  [data-motion='full'] & .bar { transform-box: fill-box; transform-origin: bottom; animation: growBar .7s var(--d, 0ms) $ease-out both; }
  &__avg line { stroke: $text-2; stroke-width: 1.25; stroke-dasharray: 3 4; opacity: .7; }
  &__legend {
    display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 12px; color: $text-2; margin-bottom: 10px;
    span { display: inline-flex; align-items: center; gap: 6px; }
    i { width: 10px; height: 10px; border-radius: 3px; }
  }
  &__avg-key i { width: 14px !important; height: 0 !important; border-radius: 0 !important; border-top: 1.5px dashed $text-2; }
}
@keyframes growBar { from { transform: scaleY(0); } }
</style>
