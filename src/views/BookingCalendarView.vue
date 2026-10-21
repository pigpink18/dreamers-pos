<script setup>
/**
 * LỊCH ĐẶT PHÒNG dạng timeline: mỗi hàng là 1 phòng, mỗi cột là 1 ngày.
 * Bấm ô trống để đặt phòng, bấm thanh màu để xem/sửa lượt đặt.
 */
import { ref, computed } from 'vue'
import Icon from '../components/ui/Icon.vue'
import BaseModal from '../components/ui/BaseModal.vue'
import BookingFormModal from '../components/rooms/BookingFormModal.vue'
import CheckoutModal from '../components/rooms/CheckoutModal.vue'
import InvoiceDetailModal from '../components/invoices/InvoiceDetailModal.vue'
import { useRooms, BOOKING_STATUS } from '../stores/rooms'
import { useUi } from '../stores/ui'
import { useAuth } from '../stores/auth'
import { money, fmtDate, dateKey, addDays, diffDays, weekday, parseKey } from '../utils/format'

const rooms = useRooms()
const ui = useUi()
const auth = useAuth()
const today = dateKey()

const DAYS = ref(14)
const start = ref(addDays(today, -2))
const days = computed(() => Array.from({ length: DAYS.value }, (_, i) => addDays(start.value, i)))
const end = computed(() => addDays(start.value, DAYS.value))
const sortedRooms = computed(() => rooms.rooms)

// Các thanh booking nằm trong khung đang xem
function barsOf(room) {
  return rooms.liveBookings
    .filter((b) => b.roomId === room.id && b.checkIn < end.value && b.checkOut > start.value)
    .map((b) => {
      const s = Math.max(0, diffDays(start.value, b.checkIn))
      const e = Math.min(DAYS.value, diffDays(start.value, b.checkOut))
      return { b, left: s, span: e - s, cutL: b.checkIn < start.value, cutR: b.checkOut > end.value }
    })
}
// Công suất phòng mỗi ngày
const occupancy = computed(() =>
  days.value.map((d) => {
    const n = rooms.rooms.filter((r) => rooms.bookingOn(r.id, d)).length
    return rooms.rooms.length ? Math.round((n / rooms.rooms.length) * 100) : 0
  })
)

const monthLabel = computed(() => {
  const a = parseKey(start.value), b = parseKey(addDays(end.value, -1))
  const f = (d) => `Tháng ${d.getMonth() + 1}/${d.getFullYear()}`
  return f(a) === f(b) ? f(a) : `${f(a)} – ${f(b)}`
})

const bookingForm = ref(null)
const selected = ref(null)
const checkoutId = ref(null)
const invoiceId = ref(null)

function onCell(room, day) {
  if (day < today || !auth.can('rooms.book')) return
  bookingForm.value = { preset: { roomId: room.id, checkIn: day } }
}
async function act(kind) {
  const b = selected.value
  if (kind === 'checkin') {
    const r = rooms.roomById(b.roomId)
    if (r?.housekeeping === 'dirty' && !(await ui.confirm(`Phòng ${r.name} chưa dọn. Vẫn nhận phòng?`, { okText: 'Vẫn nhận phòng' }))) return
    try { rooms.checkIn(b.id) } catch (e) { return ui.toast(e.message, 'error') }
    ui.toast(`${b.guestName} đã nhận phòng`)
  }
  if (kind === 'cancel') {
    if (!(await ui.confirm(`Huỷ đặt phòng ${b.code}?`, { danger: true, okText: 'Huỷ đặt phòng' }))) return
    // Đã đặt cọc -> huỷ là phải hoàn tiền, cần người có quyền huỷ/hoàn tiền duyệt
    let approver = null
    if (b.deposit > 0) {
      approver = await ui.approve({ perm: 'invoices.cancel', reason: `Huỷ ${b.code} · hoàn cọc ${b.deposit.toLocaleString('vi-VN')} ₫` })
      if (!approver) return
    }
    rooms.cancelBooking(b.id, approver)
    ui.toast('Đã huỷ đặt phòng')
  }
  if (kind === 'checkout') checkoutId.value = b.id
  if (kind === 'edit') bookingForm.value = { booking: b }
  if (kind === 'invoice') invoiceId.value = b.invoiceId
  selected.value = null
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div><h1>Lịch đặt phòng</h1><p>{{ monthLabel }}</p></div>
      <div class="spacer"></div>
      <div class="segmented">
        <button :class="{ active: DAYS === 7 }" @click="DAYS = 7">7 ngày</button>
        <button :class="{ active: DAYS === 14 }" @click="DAYS = 14">14 ngày</button>
        <button :class="{ active: DAYS === 30 }" @click="DAYS = 30">30 ngày</button>
      </div>
      <div class="flex">
        <button class="btn btn--ghost btn--icon" @click="start = addDays(start, -7)" aria-label="Lùi"><Icon name="left" :size="16" /></button>
        <button class="btn btn--ghost" @click="start = addDays(today, -2)">Hôm nay</button>
        <button class="btn btn--ghost btn--icon" @click="start = addDays(start, 7)" aria-label="Tiến"><Icon name="right" :size="16" /></button>
      </div>
      <button v-if="auth.can('rooms.book')" class="btn btn--primary" @click="bookingForm = {}"><Icon name="plus" :size="16" />Đặt phòng</button>
    </div>

    <div class="card timeline-card">
      <div class="timeline" :style="{ '--days': DAYS }">
        <!-- Header ngày -->
        <div class="tl-row tl-head">
          <div class="tl-room">Phòng</div>
          <div class="tl-days">
            <div v-for="(d, i) in days" :key="d" class="tl-day" :class="{ today: d === today, weekend: ['T7', 'CN'].includes(weekday(d)) }">
              <span>{{ weekday(d) }}</span><b>{{ parseKey(d).getDate() }}</b>
              <small :title="`Công suất ${occupancy[i]}%`">{{ occupancy[i] }}%</small>
            </div>
          </div>
        </div>
        <!-- Hàng phòng -->
        <div v-for="r in sortedRooms" :key="r.id" class="tl-row">
          <div class="tl-room"><b>{{ r.name }}</b><span class="muted">{{ r.type }}</span></div>
          <div class="tl-days">
            <div v-for="d in days" :key="d" class="tl-cell" :class="{ today: d === today, past: d < today, weekend: ['T7', 'CN'].includes(weekday(d)) }" @click="onCell(r, d)"></div>
            <button
              v-for="x in barsOf(r)" :key="x.b.id" class="tl-bar" :class="[`tl-bar--${x.b.status}`, { cutL: x.cutL, cutR: x.cutR }]"
              :style="{ gridColumn: `${x.left + 1} / span ${x.span}` }" @click="selected = x.b"
              :title="`${x.b.guestName} · ${fmtDate(x.b.checkIn)} → ${fmtDate(x.b.checkOut)}`"
            >
              <b>{{ x.b.guestName }}</b><span>{{ diffDays(x.b.checkIn, x.b.checkOut) }}đ</span>
            </button>
          </div>
        </div>
      </div>
      <div class="tl-legend">
        <span v-for="k in ['booked', 'staying', 'checked_out']" :key="k"><i :class="`tl-bar--${k}`"></i>{{ BOOKING_STATUS[k].label }}</span>
        <span class="muted">· Bấm vào ô trống để đặt phòng nhanh</span>
      </div>
    </div>

    <!-- Chi tiết lượt đặt -->
    <BaseModal v-if="selected" :title="`Đặt phòng ${selected.code}`" width="460px" @close="selected = null">
      <template #header-extra>
        <span class="badge" :class="`badge--${BOOKING_STATUS[selected.status].badge}`">{{ BOOKING_STATUS[selected.status].label }}</span>
      </template>
      <dl class="dl">
        <dt>Khách</dt><dd>{{ selected.guestName }} <span class="muted">{{ selected.phone }}</span></dd>
        <dt>Phòng</dt><dd>{{ rooms.roomById(selected.roomId)?.name }} · {{ rooms.roomById(selected.roomId)?.type }}</dd>
        <dt>Thời gian</dt><dd>{{ fmtDate(selected.checkIn) }} → {{ fmtDate(selected.checkOut) }} ({{ diffDays(selected.checkIn, selected.checkOut) }} đêm)</dd>
        <dt>Số khách</dt><dd>{{ selected.guests }}</dd>
        <dt>Giá phòng</dt>
        <dd class="num">
          <template v-if="rooms.isPackage(selected)">Trọn gói {{ money(selected.packagePrice) }}</template>
          <template v-else>{{ money(rooms.rateOf(selected)) }} / đêm</template>
          <span class="muted"> · tổng {{ money(rooms.roomChargeFor(selected)) }}</span>
          <span v-if="rooms.customPrice(selected)" class="badge cal-custom">Giá riêng</span>
        </dd>
        <dt>Đặt cọc</dt><dd class="num">{{ money(selected.deposit) }}</dd>
        <dt v-if="selected.note">Ghi chú</dt><dd v-if="selected.note">{{ selected.note }}</dd>
      </dl>
      <template #footer>
        <template v-if="selected.status === 'booked'">
          <button v-if="auth.can('rooms.book')" class="btn btn--danger" @click="act('cancel')">Huỷ đặt</button>
          <div class="spacer"></div>
          <button v-if="auth.can('rooms.book')" class="btn btn--ghost" @click="act('edit')">Sửa</button>
          <button v-if="auth.can('rooms.checkin')" class="btn btn--primary" @click="act('checkin')" :disabled="selected.checkIn > today"><Icon name="login" :size="16" />Nhận phòng</button>
        </template>
        <template v-else-if="selected.status === 'staying'">
          <button v-if="auth.can('rooms.book')" class="btn btn--ghost" @click="act('edit')">Gia hạn / sửa</button>
          <button v-if="auth.can('rooms.checkin')" class="btn btn--success" @click="act('checkout')"><Icon name="logout" :size="16" />Trả phòng</button>
        </template>
        <button v-else-if="selected.invoiceId" class="btn btn--primary" @click="act('invoice')"><Icon name="receipt" :size="16" />Xem hoá đơn</button>
      </template>
    </BaseModal>

    <BookingFormModal v-if="bookingForm" v-bind="bookingForm" @close="bookingForm = null" />
    <CheckoutModal v-if="checkoutId" :booking-id="checkoutId" @close="checkoutId = null" @done="(inv) => (invoiceId = inv.id)" />
    <InvoiceDetailModal v-if="invoiceId" :invoice-id="invoiceId" @close="invoiceId = null" />
  </div>
</template>

<style lang="scss">
@use '../styles/tokens' as *;
.timeline-card { overflow: hidden; }
.cal-custom { margin-left: 6px; background: var(--warning-soft); color: var(--warning); }
.timeline { overflow-x: auto; }
.tl-row { display: flex; border-bottom: 1px solid $border; min-width: calc(140px + var(--days) * 44px); }
.tl-room { width: 140px; flex-shrink: 0; padding: 10px 14px; display: flex; flex-direction: column; justify-content: center; border-right: 1px solid $border; background: $surface; position: sticky; left: 0; z-index: 2; span { font-size: 12px; } }
.tl-days { flex: 1; display: grid; grid-template-columns: repeat(var(--days), minmax(44px, 1fr)); grid-template-rows: 52px; position: relative; }
.tl-head { background: $surface-2; .tl-room { background: $surface-2; font-size: 12px; font-weight: 600; color: $text-muted; text-transform: uppercase; } .tl-days { grid-template-rows: auto; } }
.tl-day {
  display: flex; flex-direction: column; align-items: center; padding: 8px 0 6px; font-size: 12px; color: $text-2; border-right: 1px solid $border;
  b { font-size: 16px; color: $text; }
  small { font-size: 10px; color: $text-muted; }
  &.weekend { background: $fill; }
  &.today { background: $primary; color: $on-primary; b, small { color: $on-primary; } }
}
.tl-cell {
  grid-row: 1; border-right: 1px solid $border; cursor: pointer; transition: background .1s;
  &.weekend { background: $surface-2; }
  &.today { background: tint($primary, .06); }
  &.past { background: repeating-linear-gradient(135deg, transparent 0 6px, var(--fill-2) 6px 7px); cursor: default; }
  &:not(.past):hover { background: $primary-soft; }
}
@for $i from 1 through 31 { .tl-cell:nth-child(#{$i}) { grid-column: #{$i}; } }
.tl-bar {
  grid-row: 1; align-self: center; height: 36px; margin: 0 3px; z-index: 1;
  display: flex; align-items: center; gap: 6px; padding: 0 10px; overflow: hidden;
  border: 0; border-radius: 9px; font: inherit; font-size: 12px; color: #fff; cursor: pointer; text-align: left;
  box-shadow: 0 0 0 2px $surface; transition: filter .15s, transform .1s;
  b { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  span { opacity: .85; margin-left: auto; }
  &:hover { filter: brightness(1.08); transform: translateY(-1px); }
  &.cutL { border-top-left-radius: 0; border-bottom-left-radius: 0; margin-left: 0; }
  &.cutR { border-top-right-radius: 0; border-bottom-right-radius: 0; margin-right: 0; }
  &--booked { background: $info; }
  &--staying { background: $danger; }
  &--checked_out { background: var(--text-muted); }
}
.tl-legend {
  display: flex; gap: 16px; padding: 12px 16px; font-size: 13px; color: $text-2; flex-wrap: wrap;
  span { display: inline-flex; align-items: center; gap: 6px; }
  i { width: 14px; height: 10px; border-radius: 3px; display: inline-block; }
}
.dl { display: grid; grid-template-columns: 100px 1fr; gap: 10px 12px; margin: 0; dt { color: $text-muted; } dd { margin: 0; font-weight: 500; } }
</style>
