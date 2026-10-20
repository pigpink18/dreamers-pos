<script setup>
/**
 * Bàn phím PIN kiểu iPhone. Gõ được bằng bàn phím máy tính (0–9, Backspace).
 * emit('complete', pin) khi đủ `length` số. Gọi expose shake() khi sai.
 */
import { ref, onMounted, onBeforeUnmount } from 'vue'
import Icon from '../ui/Icon.vue'

const props = defineProps({ length: { type: Number, default: 6 }, disabled: Boolean })
const emit = defineEmits(['complete'])
const pin = ref('')
const shaking = ref(false)

function press(d) {
  if (props.disabled || pin.value.length >= props.length) return
  pin.value += d
  if (pin.value.length === props.length) {
    const v = pin.value
    setTimeout(() => emit('complete', v), 120)
  }
}
const back = () => (pin.value = pin.value.slice(0, -1))
function shake() {
  shaking.value = true
  navigator.vibrate?.(200)
  setTimeout(() => { shaking.value = false; pin.value = '' }, 450)
}
const reset = () => (pin.value = '')
defineExpose({ shake, reset })

function onKey(e) {
  if (/^\d$/.test(e.key)) press(e.key)
  else if (e.key === 'Backspace') back()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="pinpad">
    <div class="pinpad__dots" :class="{ shake: shaking }">
      <span v-for="i in length" :key="i" :class="{ on: pin.length >= i }"></span>
    </div>
    <div class="pinpad__keys">
      <button v-for="d in ['1','2','3','4','5','6','7','8','9']" :key="d" type="button" @click="press(d)">{{ d }}</button>
      <span></span>
      <button type="button" @click="press('0')">0</button>
      <button type="button" class="pinpad__back" @click="back" aria-label="Xoá"><Icon name="fa-delete-left" :size="22" /></button>
    </div>
  </div>
</template>

<style lang="scss">
@use '../../styles/tokens' as *;
.pinpad {
  display: flex; flex-direction: column; align-items: center; gap: 28px;
  &__dots {
    display: flex; gap: 18px; height: 16px;
    span { width: 14px; height: 14px; border-radius: 50%; border: 1.5px solid $text-2; transition: background .12s, transform .12s; }
    span.on { background: $text; border-color: $text; transform: scale(1.05); }
    &.shake { animation: shake .4s; span { border-color: $danger; } span.on { background: $danger; } }
  }
  &__keys {
    display: grid; grid-template-columns: repeat(3, 74px); gap: 14px 22px;
    button {
      width: 74px; height: 74px; border-radius: 50%; border: 0; cursor: pointer;
      font: 400 30px $font-display; color: $text; background: $fill-2;
      transition: background .1s, transform .1s;
      &:active { background: $text-muted; transform: scale(.94); }
    }
  }
  &__back { background: transparent !important; color: $text-2 !important; }
}
@keyframes shake { 20%, 60% { transform: translateX(-10px); } 40%, 80% { transform: translateX(10px); } }
@include mobile { .pinpad { gap: 22px; } .pinpad__keys { grid-template-columns: repeat(3, 66px); gap: 10px 20px; button { width: 66px; height: 66px; font-size: 26px; } } }
</style>
