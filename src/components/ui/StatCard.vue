<script setup>
import { computed } from 'vue'
import Icon from './Icon.vue'
import { useCountUp } from '../../utils/motion'

const props = defineProps({
  label: String,
  value: String,
  icon: String,
  tone: { type: String, default: 'primary' }, // primary | success | warning | danger | info
  change: { type: Number, default: null }, // % so với kỳ trước
  hint: String,
})
// Số chạy từ 0 lên khi thẻ xuất hiện hoặc khi giá trị đổi
const shown = useCountUp(() => props.value)
const changeText = computed(() =>
  props.change === null ? '' : `${props.change >= 0 ? '▲' : '▼'} ${Math.abs(props.change).toFixed(1)}%`
)
</script>

<template>
  <div class="stat card">
    <div class="stat__icon" :class="`tone-${tone}`"><Icon :name="icon" :size="20" /></div>
    <div class="stat__body">
      <div class="stat__label">{{ label }}</div>
      <div class="stat__value num">{{ shown }}</div>
      <div class="stat__foot">
        <span v-if="change !== null" class="stat__change" :class="change >= 0 ? 'up' : 'down'">{{ changeText }}</span>
        <span v-if="hint" class="muted">{{ hint }}</span>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
@use '../../styles/tokens' as *;
// Thẻ số liệu kiểu widget của iOS
.stat {
  display: flex; flex-direction: column; gap: 12px; padding: 18px 20px;
  &__icon {
    width: 32px; height: 32px; border-radius: 9px; display: grid; place-items: center; flex-shrink: 0;
    &.tone-primary { background: $primary-soft; color: $primary; }
    &.tone-success { background: $success-soft; color: $success; }
    &.tone-warning { background: $warning-soft; color: $warning; }
    &.tone-danger { background: $danger-soft; color: $danger; }
    &.tone-info { background: $info-soft; color: $info; }
  }
  &__body { min-width: 0; }
  &__label { font-size: 13px; color: $text-2; font-weight: 500; }
  &__value { font-family: $font-display; font-size: 26px; font-weight: 700; letter-spacing: -0.025em; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  &__foot { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 6px; font-size: 12px; margin-top: 4px; min-height: 18px; }
  &__change {
    font-weight: 600; white-space: nowrap; padding: 0 6px; border-radius: 6px;
    &.up { color: $success; background: $success-soft; } &.down { color: $danger; background: $danger-soft; }
  }
  @include mobile {
    padding: 14px; gap: 10px;
    &__value { font-size: 20px; }
    &__foot .muted { display: none; }
  }
}
</style>
