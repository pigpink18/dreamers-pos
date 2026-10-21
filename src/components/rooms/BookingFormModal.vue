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
import RoomRateInput from './RoomRateInput.vue'
import { useAuth } from '../../stores/auth'
import { useAudit } from '../../stores/audit'

/** preset: { roomId?, checkIn? } khi tạo mới · booking: khi sửa */
const props = defineProps({ booking: Object, preset: Object })
const emit = defineEmits(['close', 'saved'])
const rooms = useRooms()
const customers = useCustomers()
const ui = useUi()
const auth = useAuth()

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

// Giá phòng riêng cho lượt đặt này (mặc định = giá niêm yết, sửa được)
if (!form.priceMode) form.priceMode = 'night'
if (form.rate == null) form.rate = rooms.rateOf(form)
if (form.packagePrice == null) form.packagePrice = 0
const orig = { priceMode: form.priceMode, rate: +form.rate, packagePrice: +form.packagePrice }
// Đổi phòng: nếu đang dùng giá niêm yết của phòng cũ thì đổi theo giá phòng mới
watch(() => form.roomId, (id, old) => {
  const oldPrice = rooms.roomById(old)?.price
  if (form.priceMode === 'night' && (+form.rate === +oldPrice || !+form.rate)) form.rate = rooms.roomById(id)?.price || 0
})

const room = computed(() => rooms.roomById(form.roomId))
const nights = computed(() => Math.max(0, diffDays(form.checkIn, form.checkOut)))
const estimate = computed(() => rooms.roomChargeFor(form, nights.value))
const remain = computed(() => estimate.value - (+form.deposit || 0))
const conflict = computed(() => form.roomId && form.checkOut > form.checkIn ? rooms.findConflict(form) : null)

async function submit() {
  if (!form.guestName.trim()) return ui.toast('Nhập tên khách hoặc chọn khách hàng', 'error')
  if (form.priceMode === 'package' ? !(+form.packagePrice > 0) : !(+form.rate > 0)) {
    const ok = await ui.confirm('Lượt đặt này đang để giá phòng 0 ₫ (miễn phí). Vẫn lưu?', { title: 'Giá phòng 0 ₫?', okText: 'Vẫn lưu' })
    if (!ok) return
  }
  // Giảm giá phòng thấp hơn giá niêm yết quá mức cho phép -> cần người có quyền duyệt
  const changed = !props.booking || form.priceMode !== orig.priceMode || +form.rate !== orig.rate || +form.packagePrice !== orig.packagePrice
  const list = nights.value * (room.value?.price || 0)
  if (changed && list && estimate.value < list) {
    const pct = Math.ceil(((list - estimate.value) / list) * 100)
    if (!auth.can('pos.discount') || pct > auth.maxDiscount) {
      const approver = await ui.approve({
        perm: 'pos.discount',
        reason: `Giá phòng ${room.value.name} thấp hơn niêm yết ${money(list - estimate.value)} (${pct}%)`,
        check: (u) => (auth.roleById(u.roleId)?.maxDiscount ?? 0) >= pct,
      })
      if (!approver) return
      useAudit().log('invoice.discount', `Giá phòng ${room.value.name} ${money(estimate.value)} (niêm yết ${money(list)}) · ${form.guestName}`, { approvedBy: approver })
    }
  }
  try {
    // Khách mới chưa có trong danh bạ -> tự tạo
    if (!form.customerId) {
      const exist = form.phone && customers.byPhone(form.phone)
      form.customerId = exist ? exist.id : customers.save({ name: form.guestName.trim(), phone: form.phone })
    }
    const b = rooms.saveBooking({
      ...form, deposit: +form.deposit || 0, guests: +form.guests || 1,
      priceMode: form.priceMode, rate: Math.round(+form.rate || 0), packagePrice: Math.round(+form.packagePrice || 0),
    })
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
      <div class="field full">
        <RoomRateInput
          :list-price="room?.price || 0" :nights="nights"
          v-model:mode="form.priceMode" v-model:rate="form.rate" v-model:pkg="form.packagePrice"
        />
      </div>
      <div class="field"><label>Đặt cọc</label><MoneyInput v-model="form.deposit" /></div>
      <div class="field"><label>Ghi chú</label><input class="input" v-model="form.note" placeholder="Giờ đến, yêu cầu đặc biệt..." /></div>
    </form>

    <div v-if="conflict" class="booking-est bad">⚠ Trùng lịch với {{ conflict.code }} – {{ conflict.guestName }}</div>
    <div v-else class="booking-est">
      <div class="booking-est__row">
        <span v-if="form.priceMode === 'package'">Trọn gói {{ nights }} đêm</span>
        <span v-else class="num">{{ nights }} đêm × {{ money(form.rate) }}</span>
        <b class="num">{{ money(estimate) }}</b>
      </div>
      <div v-if="+form.deposit" class="booking-est__row"><span>Đặt cọc</span><span class="num">− {{ money(form.deposit) }}</span></div>
      <div v-if="+form.deposit" class="booking-est__row booking-est__total">
        <span>{{ remain >= 0 ? 'Còn lại khi trả phòng' : 'Cọc dư (hoàn khách)' }}</span><b class="num">{{ money(Math.abs(remain)) }}</b>
      </div>
      <small class="booking-est__note">Tạm tính theo lịch đặt · có thể sửa giá lại lúc trả phòng</small>
    </div>

    <template #footer>
      <button class="btn btn--ghost" @click="emit('close')">Huỷ</button>
      <button class="btn btn--primary" type="submit" form="bform" :disabled="!!conflict">Lưu đặt phòng</button>
    </template>
  </BaseModal>
</template>

<style lang="scss">
.booking-est {
  display: flex; flex-direction: column; gap: 6px; margin-top: 18px; padding: 12px 14px;
  border-radius: 10px; background: var(--primary-soft); color: var(--primary);
  &.bad { background: var(--danger-soft); color: var(--danger); font-weight: 600; }
  &__row { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
  &__total { padding-top: 6px; border-top: 1px dashed currentColor; b { font-size: 17px; } }
  &__note { opacity: .75; font-size: 12px; }
}
</style>
