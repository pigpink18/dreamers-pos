<script setup>
/**
 * Dropdown có ô tìm kiếm (giống Select2) dùng vue-multiselect.
 *   <AppSelect v-model="roomId" :options="[{ value: 'id1', label: 'Mây', sub: '820.000 ₫' }]" />
 * options có thể là mảng chuỗi: ['A', 'B']
 */
import { computed } from 'vue'
import Multiselect from 'vue-multiselect'

const props = defineProps({
  modelValue: [String, Number, null],
  options: { type: Array, default: () => [] },
  placeholder: { type: String, default: 'Chọn…' },
  searchable: { type: Boolean, default: undefined }, // mặc định: tự bật khi có > 7 lựa chọn
  disabled: Boolean,
  allowEmpty: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'change'])

const opts = computed(() => props.options.map((o) => (typeof o === 'object' ? o : { value: o, label: String(o) })))
const selected = computed({
  get: () => opts.value.find((o) => o.value === props.modelValue) ?? null,
  set: (o) => {
    const v = o ? o.value : ''
    emit('update:modelValue', v)
    emit('change', v)
  },
})
const canSearch = computed(() => props.searchable ?? opts.value.length > 7)
</script>

<template>
  <Multiselect
    v-model="selected"
    class="app-select"
    :options="opts"
    track-by="value"
    label="label"
    :placeholder="placeholder"
    :searchable="canSearch"
    :disabled="disabled"
    :allow-empty="allowEmpty"
    :show-labels="false"
    :close-on-select="true"
    :max-height="280"
    open-direction="bottom"
  >
    <template #option="{ option }">
      <div class="app-select__opt">
        <span>{{ option.label }}</span>
        <small v-if="option.sub" class="muted">{{ option.sub }}</small>
      </div>
    </template>
    <template #noResult>Không tìm thấy</template>
    <template #noOptions>Chưa có lựa chọn</template>
  </Multiselect>
</template>

<style>
.app-select { min-width: 140px; }
.app-select__opt { display: flex; justify-content: space-between; gap: 10px; align-items: baseline; }
.app-select__opt small { flex-shrink: 0; font-size: 12px; }
</style>
