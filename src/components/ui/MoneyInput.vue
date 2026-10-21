<script setup>
/**
 * Ô nhập tiền: gõ 820000, 820.000 hay 820k đều được, tự hiện dấu chấm phân cách (820.000).
 * v-model trả về số (Number). nullable = true thì ô trống trả về null (VD "Khách đưa" chưa nhập).
 */
import { ref, watch } from 'vue'

const props = defineProps({
  modelValue: { type: [Number, String], default: null },
  nullable: Boolean,
  placeholder: String,
})
const emit = defineEmits(['update:modelValue'])

// 0 hiện ô trống (chữ 0 mờ làm placeholder) để gõ số mới không bị dính số 0 phía trước
const fmt = (n) => (n === null || n === '' || n === undefined || isNaN(+n) || +n === 0 ? '' : Math.round(+n).toLocaleString('vi-VN'))
/** '820.000' | '820000' | '820k' | '1,2tr' -> 820000 / 1200000 */
function parse(t) {
  const s = String(t ?? '').toLowerCase().trim()
  if (!s) return null
  const m = s.match(/^([\d.,\s]*)(k|n|tr|m)?$/)
  if (m && m[2]) {
    // "1,5k" / "1.5k" = 1.500 ; "1.500k" (chấm ngăn hàng nghìn) = 1.500.000
    const num = m[1].replace(/\s/g, '')
    const dec = num.match(/^(\d*)[.,](\d{1,2})$/)
    const base = dec ? parseFloat(`${dec[1] || 0}.${dec[2]}`) : parseFloat(num.replace(/[.,]/g, '')) || 0
    return Math.round(base * (m[2] === 'k' || m[2] === 'n' ? 1e3 : 1e6))
  }
  const d = s.replace(/\D/g, '')
  return d === '' ? null : +d
}

const text = ref(fmt(props.modelValue))
const norm = (v) => (v === null || v === '' || v === undefined ? (props.nullable ? null : 0) : +v)
watch(() => props.modelValue, (v) => {
  if (norm(parse(text.value)) !== norm(v)) text.value = fmt(v)
})

function onInput(e) {
  const el = e.target
  const raw = el.value
  // đang gõ đơn vị (k / tr) hoặc vừa gõ dấu chấm/phẩy (VD "1,5" sắp thành "1,5k" hay "820." sắp thành "820.000"):
  // giữ nguyên chữ đang gõ, chỉ cập nhật giá trị
  if (/[a-z]$/i.test(raw.trim()) || /\d[.,]\d{0,2}$/.test(raw.trim())) {
    text.value = raw
    emit('update:modelValue', norm(parse(raw)))
    return
  }
  // giữ con trỏ đúng vị trí sau khi chèn dấu chấm: đếm số chữ số bên phải con trỏ
  const right = raw.slice(el.selectionStart ?? raw.length).replace(/\D/g, '').length
  const n = parse(raw)
  text.value = fmt(n)
  el.value = text.value
  let pos = text.value.length, seen = 0
  while (pos > 0 && seen < right) { if (/\d/.test(text.value[pos - 1])) seen++; pos-- }
  try { el.setSelectionRange(pos, pos) } catch {}
  emit('update:modelValue', norm(n))
}
// rời ô: chuẩn hoá cách hiển thị (VD "82k" -> "82.000")
const onBlur = () => (text.value = fmt(norm(parse(text.value))))
</script>

<template>
  <input class="input num" type="text" inputmode="numeric" autocomplete="off" :value="text" :placeholder="placeholder ?? (nullable ? '' : '0')" @input="onInput" @blur="onBlur" />
</template>
