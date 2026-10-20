<script setup>
import { onMounted, onBeforeUnmount } from 'vue'
import Icon from './Icon.vue'

const props = defineProps({
  title: String,
  width: { type: String, default: '520px' },
})
const emit = defineEmits(['close'])

const onKey = (e) => e.key === 'Escape' && emit('close')
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <div class="modal-backdrop" @mousedown.self="emit('close')">
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
