<script setup>
/**
 * Icon dùng Font Awesome 6 Pro (kiểu Light).
 * Dùng tên ngắn quen thuộc trong app: <Icon name="cart" />
 * hoặc tên gốc của Font Awesome: <Icon name="fa-mug-hot" />
 */
import { computed } from 'vue'

const props = defineProps({ name: String, size: { type: [Number, String], default: 18 } })

const MAP = {
  dashboard: 'table-cells-large', pos: 'cash-register', receipt: 'receipt', box: 'box', users: 'users', bed: 'bed-front',
  calendar: 'calendar-days', chart: 'chart-mixed', settings: 'gear', plus: 'plus', minus: 'minus', x: 'xmark',
  trash: 'trash-can', edit: 'pen-to-square', print: 'print', download: 'arrow-down-to-line', upload: 'upload',
  left: 'chevron-left', right: 'chevron-right', check: 'check', login: 'arrow-right-to-bracket',
  logout: 'arrow-right-from-bracket', sparkle: 'sparkles', alert: 'triangle-exclamation', money: 'money-bill-wave',
  trend: 'chart-line', cart: 'cart-shopping', broom: 'broom', phone: 'phone', menu: 'bars', sun: 'sun',
  moon: 'moon', monitor: 'desktop', search: 'magnifying-glass', coffee: 'mug-saucer', enter: 'arrow-turn-down',
  bell: 'bell', info: 'circle-info', key: 'key', door: 'door-open', wallet: 'wallet', 'calendar-plus': 'calendar-plus',
  'user-plus': 'user-plus', concierge: 'bell-concierge', utensils: 'utensils', gift: 'gift', mug: 'mug-hot', list: 'list-check',
}
const cls = computed(() => 'fa-' + (props.name?.startsWith('fa-') ? props.name.slice(3) : MAP[props.name] || props.name))
const px = computed(() => (typeof props.size === 'number' ? props.size + 'px' : props.size))
</script>

<template>
  <i class="icon fa-light" :class="cls" :style="{ fontSize: px, width: px, height: px }" aria-hidden="true"></i>
</template>

<style>
.icon { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; line-height: 1; font-style: normal; }
</style>
