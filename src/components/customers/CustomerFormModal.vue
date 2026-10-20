<script setup>
import { reactive } from 'vue'
import BaseModal from '../ui/BaseModal.vue'
import { useCustomers } from '../../stores/customers'
import { useUi } from '../../stores/ui'

const props = defineProps({ customer: Object, presetName: String })
const emit = defineEmits(['close', 'saved'])
const customers = useCustomers()
const ui = useUi()

const form = reactive({ name: props.presetName || '', phone: '', email: '', address: '', note: '', ...(props.customer || {}) })

function submit() {
  if (!form.name.trim()) return ui.toast('Vui lòng nhập tên khách hàng', 'error')
  if (form.phone && customers.items.some((c) => c.phone === form.phone && c.id !== form.id))
    return ui.toast('Số điện thoại đã tồn tại', 'error')
  const id = customers.save({ ...form, name: form.name.trim() })
  ui.toast(props.customer ? 'Đã cập nhật khách hàng' : 'Đã thêm khách hàng')
  emit('saved', id)
  emit('close')
}
</script>

<template>
  <BaseModal :title="customer ? 'Sửa khách hàng' : 'Thêm khách hàng'" @close="emit('close')">
    <form class="form-grid" @submit.prevent="submit" id="customer-form">
      <div class="field full"><label>Tên khách hàng *</label><input class="input" v-model="form.name" autofocus /></div>
      <div class="field"><label>Điện thoại</label><input class="input" v-model="form.phone" /></div>
      <div class="field"><label>Email</label><input class="input" v-model="form.email" type="email" /></div>
      <div class="field full"><label>Địa chỉ</label><input class="input" v-model="form.address" /></div>
      <div class="field full"><label>Ghi chú</label><textarea class="textarea" rows="2" v-model="form.note"></textarea></div>
    </form>
    <template #footer>
      <button class="btn btn--ghost" @click="emit('close')">Huỷ</button>
      <button class="btn btn--primary" type="submit" form="customer-form">Lưu</button>
    </template>
  </BaseModal>
</template>
