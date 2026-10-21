<script setup>
/**
 * Ô giảm giá: chọn giảm theo số tiền (₫) hoặc theo phần trăm (%).
 * v-model      = SỐ TIỀN giảm (₫), luôn được cập nhật (chế độ % tự tính lại khi tổng tiền thay đổi).
 * v-model:pct  = (tuỳ chọn) số % đang dùng; null = đang giảm theo ₫. Truyền vào để nhớ chế độ % theo từng hoá đơn.
 * VD base = 30.000, chọn % rồi nhập 10 -> v-model = 3.000
 */
import { ref, computed, watch } from 'vue'
import MoneyInput from './MoneyInput.vue'

const props = defineProps({
  modelValue: { type: [Number, String], default: 0 },
  base: { type: Number, default: 0 }, // tổng tiền trước giảm
  pct: { type: Number, default: undefined },
})
const emit = defineEmits(['update:modelValue', 'update:pct'])

// Có truyền v-model:pct -> chế độ % lưu ở ngoài (theo hoá đơn); không truyền -> tự nhớ trong ô
const controlled = computed(() => props.pct !== undefined)
const localMode = ref('amount')
const localPct = ref(null)
const mode = computed(() => (controlled.value ? (props.pct === null ? 'amount' : 'pct') : localMode.value))
const pctVal = computed(() => (controlled.value ? props.pct : localPct.value))
const setPct = (v) => (controlled.value ? emit('update:pct', v) : (localPct.value = v))

const clampPct = (v) => Math.min(100, Math.max(0, +v || 0))
const fromPct = () => Math.round((props.base * clampPct(pctVal.value)) / 100)
const sync = () => { if (mode.value === 'pct' && +props.modelValue !== fromPct()) emit('update:modelValue', fromPct()) }

watch([pctVal, () => props.base], sync)
// Ô tự nhớ (VD trả phòng): giỏ trống thì bỏ % để không mang sang lần sau
watch(() => props.base, (b) => { if (!b && !controlled.value) localPct.value = null })

function setMode(m) {
  if (m === mode.value) return
  if (m === 'pct') {
    const cur = props.base && +props.modelValue ? Math.round((+props.modelValue / props.base) * 1000) / 10 : 0
    if (!controlled.value) localMode.value = 'pct'
    setPct(cur)
  } else {
    if (controlled.value) emit('update:pct', null)
    else localMode.value = 'amount'
  }
}
function onPct(e) {
  const v = e.target.value.replace(',', '.').replace(/[^\d.]/g, '')
  const n = v === '' ? 0 : clampPct(v)
  setPct(n)
  if (v !== '' && !v.endsWith('.') && String(n) !== v) e.target.value = n
}
</script>

<template>
  <div class="disc-input">
    <MoneyInput v-if="mode === 'amount'" class="input--sm text-right disc-input__field" :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" />
    <input v-else class="input input--sm num text-right disc-input__field" type="text" inputmode="decimal" autocomplete="off" placeholder="0" :value="pctVal || ''" @input="onPct" />
    <div class="disc-input__mode" role="group" aria-label="Kiểu giảm giá">
      <button type="button" :class="{ on: mode === 'amount' }" aria-label="Giảm theo số tiền" @click="setMode('amount')">₫</button>
      <button type="button" :class="{ on: mode === 'pct' }" aria-label="Giảm theo phần trăm" @click="setMode('pct')">%</button>
    </div>
  </div>
</template>

<style lang="scss">
@use '../../styles/tokens' as *;
.disc-input {
  display: inline-flex; align-items: center; gap: 6px;
  &__field { width: 110px; }
  &__mode {
    display: inline-flex; padding: 2px; border-radius: 8px; background: $fill;
    button {
      min-width: 30px; height: 28px; border: 0; border-radius: 6px; background: transparent; color: $text-2;
      font: inherit; font-size: 13px; font-weight: 600; cursor: pointer;
      &.on { background: $surface; color: $primary; box-shadow: $shadow-sm; }
    }
  }
}
@media (hover: none) and (pointer: coarse) {
  .disc-input__mode button { min-width: 40px; height: 36px; }
  .disc-input__field { height: 40px; }
}
</style>
