<script setup>
import { printReceipt } from '../../utils/print'
/** Xem & in: Phiếu chốt ca | Tổng kết ngày (ngày của ca đó) */
import { ref, computed } from 'vue'
import BaseModal from '../ui/BaseModal.vue'
import Icon from '../ui/Icon.vue'
import ShiftReceipt from './ShiftReceipt.vue'
import DailyReceipt from './DailyReceipt.vue'
import { dateKey, fmtDate } from '../../utils/format'

const props = defineProps({
  shift: { type: Object, default: null },  // null = chỉ in tổng ngày
  date: { type: String, default: '' },
  tab: { type: String, default: 'shift' }, // 'shift' | 'day'
  title: { type: String, default: '' },
})
const emit = defineEmits(['close'])
const view = ref(props.shift ? props.tab : 'day')
const day = computed(() => props.date || (props.shift ? dateKey(props.shift.openedAt) : dateKey()))
const print = () => printReceipt()
</script>

<template>
  <BaseModal :title="title || (view === 'shift' ? `Phiếu chốt ca ${shift.code}` : `Tổng kết ngày ${fmtDate(day)}`)" width="440px" @close="emit('close')">
    <slot />
    <div v-if="shift" class="segmented print-switch">
      <button :class="{ active: view === 'shift' }" @click="view = 'shift'">Phiếu chốt ca</button>
      <button :class="{ active: view === 'day' }" @click="view = 'day'">Tổng kết ngày</button>
    </div>
    <ShiftReceipt v-if="view === 'shift' && shift" :shift="shift" />
    <DailyReceipt v-else :date="day" />
    <template #footer>
      <button class="btn btn--ghost" @click="emit('close')">Đóng</button>
      <button class="btn btn--primary" @click="print"><Icon name="print" :size="15" />{{ view === 'shift' ? 'In phiếu ca' : 'In tổng kết ngày' }}</button>
    </template>
  </BaseModal>
</template>

<style lang="scss">
.print-switch { display: flex; margin: 0 auto 14px; width: fit-content; }
</style>
