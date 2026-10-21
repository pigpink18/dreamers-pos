<script setup>
import { onMounted, onBeforeUnmount } from 'vue'
import Icon from './Icon.vue'
import { lockScroll, unlockScroll } from '../../utils/scrollLock'

const props = defineProps({
  title: String,
  width: { type: String, default: '520px' },
})
const emit = defineEmits(['close'])

const onKey = (e) => e.key === 'Escape' && emit('close')
onMounted(() => { window.addEventListener('keydown', onKey); lockScroll() })
onBeforeUnmount(() => { window.removeEventListener('keydown', onKey); unlockScroll() })

// Chạm ra ngoài để đóng: chỉ đóng khi cả lúc nhấn và lúc nhả đều ở nền tối.
// Đóng bằng "click" (không phải pointerdown) để cú chạm không xuyên xuống nút phía dưới.
let downOnBackdrop = false
const onDown = (e) => (downOnBackdrop = e.target === e.currentTarget)
const onClick = (e) => { if (downOnBackdrop && e.target === e.currentTarget) emit('close'); downOnBackdrop = false }
</script>

<template>
  <Teleport to="body">
    <div class="modal-backdrop" @pointerdown="onDown" @click="onClick">
      <div class="modal" :style="{ maxWidth: width }" role="dialog" aria-modal="true">
        <header class="modal__header">
          <h3>{{ title }}</h3>
          <slot name="header-extra" />
          <button class="btn btn--ghost btn--icon btn--sm modal__close" @click="emit('close')" aria-label="Đóng">
            <Icon name="x" :size="16" />
          </button>
        </header>
        <div class="modal__body"><slot /></div>
        <footer v-if="$slots.footer" class="modal__footer"><slot name="footer" /></footer>
      </div>
    </div>
  </Teleport>
</template>
