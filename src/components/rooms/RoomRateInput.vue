<script setup>
/**
 * Ô nhập giá phòng cho từng lượt đặt (giá không cố định).
 * - Theo đêm: nhập giá / đêm, có nút nhanh (giá niêm yết, −10%, −20%, +20% lễ/Tết)
 * - Trọn gói: nhập tổng tiền phòng cho cả kỳ ở (VD combo 2 đêm 900k)
 * v-model:mode ('night' | 'package') · v-model:rate · v-model:pkg
 */
import { computed } from 'vue'
import MoneyInput from '../ui/MoneyInput.vue'
import { money } from '../../utils/format'

const props = defineProps({
  listPrice: { type: Number, default: 0 }, // giá niêm yết / đêm của phòng
  nights: { type: Number, default: 1 },
  mode: { type: String, default: 'night' },
  rate: { type: [Number, String], default: 0 },
  pkg: { type: [Number, String], default: 0 },
})
const emit = defineEmits(['update:mode', 'update:rate', 'update:pkg'])

const n = computed(() => Math.max(1, props.nights || 1))
const round1k = (v) => Math.round(v / 1000) * 1000
const listTotal = computed(() => props.listPrice * n.value)
const charge = computed(() => (props.mode === 'package' ? +props.pkg || 0 : (+props.rate || 0) * n.value))
const perNight = computed(() => (props.mode === 'package' ? round1k(charge.value / n.value) : +props.rate || 0))

const presets = computed(() => {
  const L = props.listPrice
  if (!L) return []
  return [
    { label: 'Niêm yết', v: L },
    { label: '−10%', v: round1k(L * 0.9) },
    { label: '−20%', v: round1k(L * 0.8) },
    { label: '+20% lễ/Tết', v: round1k(L * 1.2) },
  ]
})

// So với giá niêm yết
const diff = computed(() => charge.value - listTotal.value)
const diffPct = computed(() => (listTotal.value ? Math.round((Math.abs(diff.value) / listTotal.value) * 100) : 0))

function setMode(m) {
  if (m === props.mode) return
  if (m === 'package') emit('update:pkg', (+props.rate || 0) * n.value)
  else emit('update:rate', round1k((+props.pkg || 0) / n.value))
  emit('update:mode', m)
}
</script>

<template>
  <div class="rate-input">
    <div class="rate-input__head">
      <label>Giá phòng</label>
      <div class="segmented rate-input__mode" role="group" aria-label="Cách tính giá phòng">
        <button type="button" :class="{ active: mode !== 'package' }" @click="setMode('night')">Theo đêm</button>
        <button type="button" :class="{ active: mode === 'package' }" @click="setMode('package')">Trọn gói</button>
      </div>
    </div>

    <div v-if="mode !== 'package'" class="rate-input__row">
      <MoneyInput class="rate-input__field" :model-value="rate" aria-label="Giá mỗi đêm" @update:model-value="emit('update:rate', $event)" />
      <span class="rate-input__unit">₫ / đêm</span>
    </div>
    <div v-else class="rate-input__row">
      <MoneyInput class="rate-input__field" :model-value="pkg" aria-label="Tổng tiền phòng" @update:model-value="emit('update:pkg', $event)" />
      <span class="rate-input__unit">₫ cho {{ n }} đêm</span>
    </div>

    <div v-if="mode !== 'package' && presets.length" class="rate-input__presets">
      <button v-for="p in presets" :key="p.label" type="button" class="rate-chip" :class="{ active: +rate === p.v }" @click="emit('update:rate', p.v)">
        <span>{{ p.label }}</span><b class="num">{{ money(p.v) }}</b>
      </button>
    </div>
    <div v-else-if="mode === 'package' && listPrice" class="rate-input__chips">
      <button type="button" class="chip" :class="{ active: +pkg === listTotal }" @click="emit('update:pkg', listTotal)">
        Theo giá niêm yết&nbsp;<span class="num">{{ money(listTotal) }}</span>
      </button>
    </div>

    <div class="rate-input__hint" :class="{ down: diff < 0, up: diff > 0 }">
      <template v-if="mode === 'package'">≈ {{ money(perNight) }} / đêm · </template>
      <template v-if="!listPrice">Phòng chưa có giá niêm yết</template>
      <template v-else-if="diff === 0">Đúng giá niêm yết {{ money(listPrice) }} / đêm</template>
      <template v-else-if="diff < 0">Rẻ hơn giá niêm yết {{ money(-diff) }} (−{{ diffPct }}%)</template>
      <template v-else>Cao hơn giá niêm yết {{ money(diff) }} (+{{ diffPct }}%)</template>
    </div>
  </div>
</template>

<style lang="scss">
@use '../../styles/tokens' as *;
.rate-input {
  display: flex; flex-direction: column; gap: 10px; padding: 14px; min-width: 0; border-radius: 12px; background: $surface-2; border: 1px solid $border;
  &__head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; label { font-weight: 600; } }
  &__mode button { white-space: nowrap; }
  &__row { display: flex; align-items: center; gap: 10px; min-width: 0; }
  &__field { flex: 1; min-width: 0; font-size: 20px !important; font-weight: 700; height: 46px; text-align: right; }
  &__unit { color: $text-2; white-space: nowrap; }
  &__chips { display: flex; flex-wrap: wrap; gap: 6px; .chip { height: 30px; font-size: 12px; padding: 0 10px; } }
  &__presets { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
  &__hint {
    font-size: 13px; color: $text-2;
    &.down { color: $warning; } &.up { color: $success; }
  }
}
.rate-chip {
  display: flex; flex-direction: column; align-items: flex-start; gap: 1px; min-width: 0; padding: 7px 10px; border: 0; border-radius: 10px;
  background: $surface; box-shadow: inset 0 0 0 1px $border-strong; font: inherit; color: $text; cursor: pointer; text-align: left;
  span { font-size: 11px; color: $text-2; white-space: nowrap; }
  b { font-size: 13px; font-weight: 600; white-space: nowrap; }
  &:hover { background: $surface-2; }
  &.active { background: $text; box-shadow: none; span, b { color: $surface; } }
}
@media (max-width: 640px) { .rate-input__presets { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (hover: none) and (pointer: coarse) { .rate-input__chips .chip { height: 34px; font-size: 13px; } }
</style>
