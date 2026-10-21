<script setup>
import AppDate from '../ui/AppDate.vue'
import AppSelect from '../ui/AppSelect.vue'
import { reactive, computed, watch } from 'vue'
import BaseModal from '../ui/BaseModal.vue'
import CustomerPicker from '../customers/CustomerPicker.vue'
import { useRooms } from '../../stores/rooms'
import { useCustomers } from '../../stores/customers'
import { useUi } from '../../stores/ui'
import { money, dateKey, addDays, diffDays } from '../../utils/format'
import MoneyInput from '../ui/MoneyInput.vue'

/** preset: { roomId?, checkIn? } khi tạo mới · booking: khi sửa */
const props = defineProps({ booking: Object, preset: Object })
const emit = defineEmits(['close', 'saved'])
const rooms = useRooms()
const customers = useCustomers()
const ui = useUi()

const today = dateKey()
const form = reactive(
  props.booking
    ? { ...props.booking }
    : {
        roomId: props.preset?.roomId || rooms.rooms[0]?.id,
        customerId: null, guestName: '', phone: '', guests: 2, deposit: 0, note: '',
        checkIn: props.preset?.checkIn || today,
        checkOut: addDays(props.preset?.checkIn || today, 1),
      }
)
// Chọn khách có sẵn -> tự điền tên & SĐT
watch(() => form.customerId, (id) => {
  const c = customers.byId(id)
  if (c) { form.guestName = c.name; form.phone = c.phone || '' }
})
watch(() => form.checkIn, (v) => { if (form.checkOut <= v) form.checkOut = addDays(v, 1) })

const room = computed(() => rooms.roomById(form.roomId))
const nights = computed(() => Math.max(0, diffDays(form.checkIn, form.checkOut)))
const estimate = computed(() => nights.value * (room.value?.price || 0))
const conflict = computed(() => form.roomId && form.checkOut > form.checkIn ? rooms.findConflict(form) : null)

function submit() {
  if (!form.guestName.trim()) return ui.toast('Nhập tên khách hoặc chọn khách hàng', 'error')
  try {
    // Khách mới chưa có trong danh bạ -> tự tạo
    if (!form.customerId) {
      const exist = form.phone && customers.byPhone(form.phone)
      form.customerId = exist ? exist.id : customers.save({ name: form.guestName.trim(), phone: form.phone })
    }
    const b = rooms.saveBooking({ ...form, deposit: +form.deposit || 0, guests: +form.guests || 1 })
    ui.toast(props.booking ? 'Đã cập nhật đặt phòng' : `Đã đặt phòng ${b.code}`)
    emit('saved', b)
    emit('close')
  } catch (e) {
    ui.toast(e.message, 'error')
  }
}
</script>

<template>
  <BaseModal :title="booking ? `Sửa đặt phòng ${booking.code}` : 'Đặt phòng mới'" width="600px" @close="emit('close')">
    <form id="bform" class="form-grid" @submit.prevent="submit">
      <div class="field full">
        <label>Khách hàng có sẵn</label>
        <CustomerPicker v-model="form.customerId" />
      </div>
      <div class="field"><label>Tên khách *</label><input class="input" v-model="form.guestName" /></div>
      <div class="field"><label>Điện thoại</label><input class="input" type="tel" inputmode="tel" autocomplete="tel" v-model="form.phone" /></div>
      <div class="field">
        <label>Phòng</label>
        <AppSelect
          v-model="form.roomId" :disabled="booking?.status === 'staying'"
          :options="rooms.rooms.map((r) => ({ value: r.id, label: `${r.name} · ${r.type}`, sub: money(r.price) + '/đêm' }))"
        />
      </div>
      <div class="field"><label>Số khách</label><input class="input" type="number" min="1" v-model="form.guests" /></div>
      <div class="field"><label>Ngày nhận phòng</label><AppDate v-model="form.checkIn" :disabled="booking?.status === 'staying'" /></div>
      <div class="field"><label>Ngày trả phòng</label><AppDate v-model="form.checkOut" :min="addDays(form.checkIn, 1)" /></div>
      <div class="field"><label>Đặt cọc</label><MoneyInput v-model="form.deposit" /></div>
      <div class="field"><label>Ghi chú</label><input class="input" v-model="form.note" placeholder="Giờ đến, yêu cầu đặc biệt..." /></div>
    </form>

    <div class="booking-est" :class="{ bad: conflict }">
      <template v-if="conflict">⚠ Trùng lịch với {{ conflict.code }} – {{ conflict.guestName }}</template>
      <template v-else>
        <span>{{ nights }} đêm × {{ money(room?.price) }}</span>
        <b class="num">Tạm tính {{ money(estimate) }}</b>
      </template>
    </div>

    <template #footer>
      <button class="btn btn--ghost" @click="emit('close')">Huỷ</button>
      <button class="btn btn--primary" type="submit" form="bform" :disabled="!!conflict">Lưu đặt phòng</button>
    </template>
  </BaseModal>
</template>

<style lang="scss">
.booking-est {
  display: flex; justify-content: space-between; align-items: center; margin-top: 18px; padding: 12px 14px;
  border-radius: 10px; background: var(--primary-soft); color: var(--primary);
  &.bad { background: var(--danger-soft); color: var(--danger); font-weight: 600; }
}
</style>
