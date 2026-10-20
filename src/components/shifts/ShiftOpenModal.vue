<script setup>
import { ref } from 'vue'
import BaseModal from '../ui/BaseModal.vue'
import Icon from '../ui/Icon.vue'
import { useShifts } from '../../stores/shifts'
import { useAuth } from '../../stores/auth'
import { useUi } from '../../stores/ui'
import { money } from '../../utils/format'

const emit = defineEmits(['close', 'opened'])
const shifts = useShifts()
const auth = useAuth()
const ui = useUi()

// Gợi ý tiền đầu ca = tiền ca trước để lại
const last = shifts.items.find((s) => s.status === 'closed')
const opening = ref(last?.countedCash ?? 1000000)
const note = ref('')

function submit() {
  try {
    const s = shifts.open(opening.value, note.value)
    ui.toast(`Đã mở ca ${s.code}`)
    emit('opened', s)
    emit('close')
  } catch (e) {
    ui.toast(e.message, 'error')
  }
}
</script>

<template>
  <BaseModal title="Mở ca làm việc" width="420px" @close="emit('close')">
    <div class="shift-head">
      <Icon name="fa-cash-register" :size="22" />
      <div><b>{{ auth.user?.name }}</b><div class="muted">{{ new Date().toLocaleString('vi-VN') }}</div></div>
    </div>
    <form id="shift-open" class="form-grid" style="grid-template-columns: 1fr" @submit.prevent="submit">
      <div class="field">
        <label>Tiền mặt đầu ca (trong két)</label>
        <input class="input input--money num" type="number" min="0" step="1000" v-model.number="opening" autofocus />
        <small v-if="last" class="muted">Ca trước ({{ last.code }}) để lại {{ money(last.countedCash) }}</small>
      </div>
      <div class="field"><label>Ghi chú</label><input class="input" v-model="note" placeholder="Không bắt buộc" /></div>
    </form>
    <template #footer>
      <button class="btn btn--ghost" @click="emit('close')">Để sau</button>
      <button class="btn btn--primary" type="submit" form="shift-open"><Icon name="fa-lock-open" :size="15" />Mở ca</button>
    </template>
  </BaseModal>
</template>

<style lang="scss">
@use '../../styles/tokens' as *;
.shift-head { display: flex; align-items: center; gap: 12px; padding: 12px 14px; margin-bottom: 16px; border-radius: 14px; background: $primary-soft; color: $primary; b { color: $text; } }
.input--money { height: 48px; font-size: 22px; font-weight: 600; }
</style>
