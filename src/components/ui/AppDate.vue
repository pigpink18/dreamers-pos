<script setup>
/**
 * Ô chọn ngày / tháng dùng @vuepic/vue-datepicker, tiếng Việt, giao diện kiểu iOS.
 *   <AppDate v-model="from" />                    -> 'YYYY-MM-DD'
 *   <AppDate v-model="month" mode="month" />      -> 'YYYY-MM'
 */
import { computed } from 'vue'
import { VueDatePicker } from '@vuepic/vue-datepicker'
import { vi } from 'date-fns/locale'
import { parseKey, dateKey } from '../../utils/format'

const props = defineProps({
  modelValue: String,
  mode: { type: String, default: 'date' }, // 'date' | 'month'
  min: String, // 'YYYY-MM-DD'
  placeholder: { type: String, default: 'Chọn ngày' },
  clearable: Boolean,
  disabled: Boolean,
})
const emit = defineEmits(['update:modelValue'])

const value = computed({
  get() {
    if (!props.modelValue) return null
    if (props.mode === 'month') {
      const [y, m] = props.modelValue.split('-').map(Number)
      return { year: y, month: m - 1 }
    }
    return parseKey(props.modelValue)
  },
  set(v) {
    if (!v) return emit('update:modelValue', '')
    if (props.mode === 'month') return emit('update:modelValue', `${v.year}-${String(v.month + 1).padStart(2, '0')}`)
    emit('update:modelValue', dateKey(v))
  },
})

const isMonth = computed(() => props.mode === 'month')
const formats = computed(() => ({ input: isMonth.value ? 'MM/yyyy' : 'dd/MM/yyyy' }))
const minDate = computed(() => (props.min ? parseKey(props.min) : undefined))
</script>

<template>
  <VueDatePicker
    v-model="value"
    class="app-date"
    :locale="vi"
    :formats="formats"
    :month-picker="isMonth"
    :time-config="{ enableTimePicker: false }"
    :min-date="minDate"
    :placeholder="placeholder"
    :input-attrs="{ clearable: clearable }"
    :action-row="{ showCancel: false, showNow: !isMonth, nowBtnLabel: 'Hôm nay', selectBtnLabel: 'Chọn' }"
    auto-apply
    week-start="1"
    :disabled="disabled"
    teleport
  />
</template>

<style>
.app-date { min-width: 150px; }
</style>
