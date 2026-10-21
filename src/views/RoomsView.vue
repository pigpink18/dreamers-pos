<script setup>
/**
 * SƠ ĐỒ PHÒNG — nhìn 1 lần biết phòng nào đang ở, đang trống, đã trả (chờ dọn), sắp nhận
 */
import { ref, reactive, computed } from 'vue'
import Icon from '../components/ui/Icon.vue'
import BaseModal from '../components/ui/BaseModal.vue'
import BookingFormModal from '../components/rooms/BookingFormModal.vue'
import CheckoutModal from '../components/rooms/CheckoutModal.vue'
import InvoiceDetailModal from '../components/invoices/InvoiceDetailModal.vue'
import { useRooms, ROOM_STATUS, BOOKING_STATUS } from '../stores/rooms'
import { useUi } from '../stores/ui'
import { useAuth, initials } from '../stores/auth'
import { money, number, fmtDate, dateKey, diffDays } from '../utils/format'
import MoneyInput from '../components/ui/MoneyInput.vue'

const rooms = useRooms()
const ui = useUi()
const auth = useAuth()
const today = dateKey()

const filter = ref('')
const floors = computed(() => {
  const g = {}
  rooms.rooms
    .filter((r) => !filter.value || rooms.statusOf(r) === filter.value)
    .forEach((r) => (g[r.floor] ||= []).push(r))
  return g
})

// Thông tin hiển thị trên thẻ phòng
function cardInfo(r) {
  const status = rooms.statusOf(r)
  const staying = rooms.stayingIn(r.id)
  const next = rooms.nextBooking(r.id)
  return { status, staying, next }
}

// Biểu tượng + thứ tự hiển thị của từng trạng thái
const ST_ICON = { vacant: 'fa-door-open', reserved: 'fa-calendar-check', occupied: 'fa-bed', checkedout: 'fa-broom' }
const ST_ORDER = ['occupied', 'reserved', 'checkedout', 'vacant']
const total = computed(() => rooms.rooms.length || 1)
const occupancy = computed(() => Math.round((rooms.summary.occupied / total.value) * 100))

// Tiến độ lưu trú: đêm thứ mấy / tổng số đêm
function stay(b) {
  const nights = Math.max(1, diffDays(b.checkIn, b.checkOut))
  const done = Math.min(nights, Math.max(1, diffDays(b.checkIn, today)))
  return { nights, done, pct: Math.round((done / nights) * 100), due: b.checkOut <= today }
}

// Hoạt động trong ngày
const arrivals = computed(() => rooms.bookings.filter((b) => b.status === 'booked' && b.checkIn <= today).sort((a, b) => a.checkIn.localeCompare(b.checkIn)))
const departures = computed(() => rooms.bookings.filter((b) => b.status === 'staying' && b.checkOut <= today))

// ---------- Modals ----------
const bookingForm = ref(null) // { booking?, preset? }
const checkoutId = ref(null)
const invoiceId = ref(null)
const roomForm = ref(null)

async function doCheckIn(b) {
  const r = rooms.roomById(b.roomId)
  if (r.housekeeping === 'dirty' && !(await ui.confirm(`Phòng ${r.name} chưa dọn. Vẫn nhận phòng?`, { okText: 'Vẫn nhận phòng' }))) return
  try { rooms.checkIn(b.id) } catch (e) { return ui.toast(e.message, 'error') }
  ui.toast(`${b.guestName} đã nhận phòng ${r.name}`)
}
async function doCancel(b) {
  if (!(await ui.confirm(`Huỷ đặt phòng ${b.code} của ${b.guestName}?`, { danger: true, okText: 'Huỷ đặt phòng' }))) return
  // Đã đặt cọc -> huỷ là phải hoàn tiền, cần người có quyền huỷ/hoàn tiền duyệt
  let approver = null
  if (b.deposit > 0) {
    approver = await ui.approve({ perm: 'invoices.cancel', reason: `Huỷ ${b.code} · hoàn cọc ${b.deposit.toLocaleString('vi-VN')} ₫` })
    if (!approver) return
  }
  rooms.cancelBooking(b.id, approver)
  ui.toast('Đã huỷ đặt phòng')
}
function clean(r) {
  rooms.markClean(r.id)
  ui.toast(`Phòng ${r.name} đã sẵn sàng`)
}

// ---------- Quản lý phòng ----------
function openRoom(r) {
  roomForm.value = reactive(r ? { ...r } : { name: '', type: 'Standard', floor: 1, price: 400000, capacity: 2 })
}
function saveRoom() {
  const f = roomForm.value
  if (!f.name.trim()) return ui.toast('Nhập tên/số phòng', 'error')
  rooms.saveRoom({ ...f, price: +f.price, floor: +f.floor, capacity: +f.capacity })
  ui.toast('Đã lưu phòng')
  roomForm.value = null
}
async function deleteRoom(r) {
  if (!(await ui.confirm(`Xoá phòng ${r.name}?`, { danger: true, okText: 'Xoá' }))) return
  try {
    rooms.removeRoom(r.id)
    roomForm.value = null
    ui.toast('Đã xoá phòng')
  } catch (e) {
    ui.toast(e.message, 'error')
  }
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div><h1>Sơ đồ phòng</h1><p>Hôm nay {{ fmtDate(today) }} · {{ rooms.rooms.length }} phòng · Nhận phòng 14:00 · Trả phòng 12:00</p></div>
      <div class="spacer"></div>
      <button v-if="auth.can('rooms.manage')" class="btn btn--ghost" @click="openRoom()"><Icon name="plus" :size="16" />Thêm phòng</button>
      <button v-if="auth.can('rooms.book')" class="btn btn--primary" @click="bookingForm = {}"><Icon name="calendar" :size="16" />Đặt phòng</button>
    </div>

    <!-- Tổng quan công suất + bộ lọc trạng thái -->
    <section class="occ card">
      <div class="occ__head">
        <div>
          <div class="occ__label">Công suất hôm nay</div>
          <div class="occ__value num">{{ occupancy }}<small>%</small></div>
        </div>
        <div class="occ__meta muted">{{ rooms.summary.occupied }}/{{ rooms.rooms.length }} phòng có khách</div>
      </div>
      <div class="occ__bar" role="img" :aria-label="`Công suất ${occupancy}%`">
        <span v-for="k in ST_ORDER" :key="k" v-show="rooms.summary[k]" :class="`occ__seg occ__seg--${k}`" :style="{ flexGrow: rooms.summary[k] }"></span>
      </div>
      <div class="status-filter">
        <button class="sf" :class="{ active: !filter }" @click="filter = ''">
          <Icon name="fa-table-cells-large" :size="13" /><span>Tất cả</span><span class="sf__n num">{{ rooms.rooms.length }}</span>
        </button>
        <button v-for="k in ST_ORDER" :key="k" class="sf" :class="[`sf--${k}`, { active: filter === k }]" @click="filter = filter === k ? '' : k">
          <i class="sf__dot"></i><span>{{ ROOM_STATUS[k].label }}</span><span class="sf__n num">{{ rooms.summary[k] }}</span>
        </button>
      </div>
    </section>

    <div class="rooms-layout">
      <div>
        <div v-for="(list, floor) in floors" :key="floor" class="floor">
          <div v-if="Object.keys(floors).length > 1" class="floor__title">Tầng {{ floor }}</div>
          <div class="room-grid">
            <article v-for="r in list" :key="r.id" class="room" :class="`room--${cardInfo(r).status}`">
              <header class="room__top">
                <span class="room__icon"><Icon :name="ST_ICON[cardInfo(r).status]" :size="17" /></span>
                <div class="room__title">
                  <div class="room__name">{{ r.name }}</div>
                  <div class="room__type">{{ r.type }} · {{ r.capacity }} khách</div>
                </div>
                <button v-if="auth.can('rooms.manage')" class="btn btn--ghost btn--icon btn--sm room__edit" @click="openRoom(r)" aria-label="Sửa phòng"><Icon name="edit" :size="14" /></button>
              </header>
              <div class="room__meta">
                <span class="badge room__status" :class="`badge--${ROOM_STATUS[cardInfo(r).status].badge}`">{{ ROOM_STATUS[cardInfo(r).status].label }}</span>
                <div v-if="cardInfo(r).staying && rooms.isPackage(cardInfo(r).staying)" class="room__price num room__price--custom" title="Giá riêng của khách đang ở">
                  {{ number(cardInfo(r).staying.packagePrice) }}<span> trọn gói</span>
                </div>
                <div v-else-if="cardInfo(r).staying && rooms.customPrice(cardInfo(r).staying)" class="room__price num room__price--custom" title="Giá riêng của khách đang ở">
                  {{ number(rooms.rateOf(cardInfo(r).staying)) }}<span> /đêm</span>
                </div>
                <div v-else class="room__price num">{{ number(r.price) }}<span> /đêm</span></div>
              </div>

              <!-- Đang ở -->
              <div v-if="cardInfo(r).staying" class="room__guest">
                <div class="guest">
                  <span class="guest__av">{{ initials(cardInfo(r).staying.guestName) }}</span>
                  <div class="guest__txt">
                    <b>{{ cardInfo(r).staying.guestName }}</b>
                    <small>{{ fmtDate(cardInfo(r).staying.checkIn) }} → {{ fmtDate(cardInfo(r).staying.checkOut) }}</small>
                  </div>
                </div>
                <div class="stay">
                  <div class="stay__bar"><span :style="{ width: stay(cardInfo(r).staying).pct + '%' }"></span></div>
                  <div class="stay__txt">
                    <span>Đêm {{ stay(cardInfo(r).staying).done }}/{{ stay(cardInfo(r).staying).nights }}</span>
                    <span v-if="stay(cardInfo(r).staying).due" class="stay__due">Đến hạn trả</span>
                  </div>
                </div>
              </div>
              <!-- Sắp nhận / lịch tiếp theo -->
              <div v-else-if="cardInfo(r).next" class="room__guest">
                <div class="guest">
                  <span class="guest__av guest__av--soft">{{ initials(cardInfo(r).next.guestName) }}</span>
                  <div class="guest__txt">
                    <small class="guest__kicker">{{ cardInfo(r).next.checkIn <= today ? 'Nhận hôm nay' : 'Lịch tiếp theo' }}</small>
                    <b>{{ cardInfo(r).next.guestName }}</b>
                    <small>{{ fmtDate(cardInfo(r).next.checkIn) }} → {{ fmtDate(cardInfo(r).next.checkOut) }}</small>
                  </div>
                </div>
              </div>
              <div v-else class="room__guest room__guest--empty"><Icon name="fa-calendar" :size="14" />Chưa có lịch đặt</div>

              <footer class="room__foot">
                <div class="room__actions">
                  <template v-if="cardInfo(r).staying">
                    <button v-if="auth.can('rooms.book')" class="btn btn--ghost btn--sm" @click="bookingForm = { booking: cardInfo(r).staying }">Gia hạn</button>
                    <button v-if="auth.can('rooms.checkin')" class="btn btn--success btn--sm" @click="checkoutId = cardInfo(r).staying.id"><Icon name="logout" :size="14" />Trả phòng</button>
                  </template>
                  <template v-else>
                    <button v-if="cardInfo(r).status === 'checkedout' && auth.can('rooms.clean')" class="btn btn--soft btn--sm" @click="clean(r)"><Icon name="broom" :size="14" />Đã dọn xong</button>
                    <button v-if="cardInfo(r).next && cardInfo(r).next.checkIn <= today && auth.can('rooms.checkin')" class="btn btn--primary btn--sm" @click="doCheckIn(cardInfo(r).next)"><Icon name="login" :size="14" />Nhận phòng</button>
                    <button v-else-if="auth.can('rooms.book') && !(cardInfo(r).next && cardInfo(r).next.checkIn <= today)" class="btn btn--ghost btn--sm" @click="bookingForm = { preset: { roomId: r.id } }">Đặt phòng</button>
                  </template>
                </div>
              </footer>
            </article>
          </div>
        </div>
        <div v-if="!Object.keys(floors).length" class="card empty">Không có phòng nào ở trạng thái này</div>
      </div>

      <!-- Cột phải: việc cần làm hôm nay -->
      <aside class="today">
        <div class="card">
          <div class="card__header"><Icon name="login" /><h3>Khách đến hôm nay</h3><span class="badge badge--info badge--plain" style="margin-left: auto">{{ arrivals.length }}</span></div>
          <div class="today__list">
            <div v-for="b in arrivals" :key="b.id" class="today__item">
              <div>
                <b>{{ b.guestName }}</b>
                <div class="muted">P.{{ rooms.roomById(b.roomId)?.name }} · {{ diffDays(b.checkIn, b.checkOut) }} đêm<span v-if="b.checkIn < today" class="text-danger"> · trễ {{ diffDays(b.checkIn, today) }} ngày</span></div>
              </div>
              <div class="flex">
                <button v-if="auth.can('rooms.checkin')" class="btn btn--primary btn--sm" @click="doCheckIn(b)">Nhận</button>
                <button v-if="auth.can('rooms.book')" class="btn btn--ghost btn--sm btn--icon" @click="doCancel(b)" aria-label="Huỷ"><Icon name="x" :size="14" /></button>
              </div>
            </div>
            <div v-if="!arrivals.length" class="muted today__empty">Không có khách đến</div>
          </div>
        </div>
        <div class="card mt-16">
          <div class="card__header"><Icon name="logout" /><h3>Đến hạn trả phòng</h3><span class="badge badge--warning badge--plain" style="margin-left: auto">{{ departures.length }}</span></div>
          <div class="today__list">
            <div v-for="b in departures" :key="b.id" class="today__item">
              <div><b>{{ b.guestName }}</b><div class="muted">P.{{ rooms.roomById(b.roomId)?.name }} · {{ rooms.nightsFor(b) }} đêm</div></div>
              <button v-if="auth.can('rooms.checkin')" class="btn btn--success btn--sm" @click="checkoutId = b.id">Trả phòng</button>
            </div>
            <div v-if="!departures.length" class="muted today__empty">Không có phòng đến hạn</div>
          </div>
        </div>
      </aside>
    </div>

    <BookingFormModal v-if="bookingForm" v-bind="bookingForm" @close="bookingForm = null" />
    <CheckoutModal v-if="checkoutId" :booking-id="checkoutId" @close="checkoutId = null" @done="(inv) => (invoiceId = inv.id)" />
    <InvoiceDetailModal v-if="invoiceId" :invoice-id="invoiceId" @close="invoiceId = null" />

    <BaseModal v-if="roomForm" :title="roomForm.id ? `Sửa phòng ${roomForm.name}` : 'Thêm phòng'" @close="roomForm = null">
      <form id="rform" class="form-grid" @submit.prevent="saveRoom">
        <div class="field"><label>Số / tên phòng *</label><input class="input" v-model="roomForm.name" autofocus /></div>
        <div class="field"><label>Loại phòng</label><input class="input" v-model="roomForm.type" /></div>
        <div class="field"><label>Tầng</label><input class="input" type="number" v-model="roomForm.floor" /></div>
        <div class="field"><label>Sức chứa (khách)</label><input class="input" type="number" min="1" v-model="roomForm.capacity" /></div>
        <div class="field full"><label>Giá / đêm</label><MoneyInput v-model="roomForm.price" /></div>
      </form>
      <template #footer>
        <button v-if="roomForm.id" class="btn btn--danger" @click="deleteRoom(roomForm)"><Icon name="trash" :size="16" />Xoá</button>
        <div class="spacer"></div>
        <button class="btn btn--ghost" @click="roomForm = null">Huỷ</button>
        <button class="btn btn--primary" type="submit" form="rform">Lưu</button>
      </template>
    </BaseModal>
  </div>
</template>

<style lang="scss">
@use 'sass:list';
@use '../styles/tokens' as *;

$st: (vacant: ($success, $success-soft), reserved: ($info, $info-soft), occupied: ($danger, $danger-soft), checkedout: ($warning, $warning-soft));

/* ---- Tổng quan công suất ---- */
.occ {
  padding: 18px 20px 16px; margin-bottom: 22px;
  &__head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; }
  &__label { font-size: 12px; font-weight: 600; color: $text-muted; letter-spacing: .02em; }
  &__value { font: 600 34px/1.05 $font-display; letter-spacing: -0.03em; small { font-size: 18px; color: $text-muted; margin-left: 2px; font-weight: 500; } }
  &__meta { font-size: 13px; padding-bottom: 4px; }
  &__bar { display: flex; gap: 3px; height: 8px; margin: 14px 0 16px; border-radius: 99px; overflow: hidden; background: $fill; }
  &__seg { flex-basis: 0; min-width: 6px; transition: flex-grow .6s $ease-out;
    @each $k, $c in $st { &--#{$k} { background: tint(list.nth($c, 1), .55); } }
    &--occupied { background: tint($danger, .75); }
  }
}
.status-filter {
  display: flex; flex-wrap: wrap; gap: 8px;
  .sf {
    display: inline-flex; align-items: center; gap: 8px; height: 34px; padding: 0 6px 0 12px;
    border: 0; border-radius: 99px; background: $fill; color: $text-2; font: inherit; font-size: 13px; font-weight: 500; cursor: pointer;
    transition: background .2s $ease, color .2s $ease, transform .2s $spring;
    &:hover { background: $fill-2; color: $text; }
    &:active { transform: scale(.96); }
    &__dot { width: 8px; height: 8px; border-radius: 50%; background: $text-muted; }
    &__n { min-width: 24px; height: 22px; padding: 0 7px; display: grid; place-items: center; border-radius: 99px;
      background: $surface; color: $text; font-size: 12px; font-weight: 600; transition: background .2s, color .2s; }
    @each $k, $c in $st {
      &--#{$k} { .sf__dot { background: list.nth($c, 1); } }
      &--#{$k}.active { background: list.nth($c, 2); color: list.nth($c, 1); .sf__n { background: list.nth($c, 1); color: #fff; } }
    }
    &.active:not([class*='sf--']) { background: $text; color: $surface; .sf__n { background: $surface; color: $text; } }
  }
}

.rooms-layout { display: grid; grid-template-columns: 1fr 320px; gap: 20px; align-items: start; }
.floor { margin-bottom: 24px;
  &__title { display: flex; align-items: center; gap: 10px; font-size: 12px; font-weight: 600; color: $text-muted; letter-spacing: .04em; text-transform: uppercase; margin-bottom: 12px;
    &::after { content: ''; flex: 1; height: 1px; background: $border; } }
}
.room-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; }

/* ---- Thẻ phòng ---- */
.room {
  --st: var(--text-muted); --st-soft: var(--fill);
  position: relative; display: flex; flex-direction: column; gap: 12px; padding: 16px;
  background: $surface; border: 1px solid $border; border-radius: $radius-lg;
  transition: transform .25s $spring, box-shadow .25s $ease, border-color .2s;
  &:hover { transform: translateY(-2px); box-shadow: $shadow; border-color: transparent; .room__edit { opacity: 1; } }
  @each $k, $c in $st { &--#{$k} { --st: #{list.nth($c, 1)}; --st-soft: #{list.nth($c, 2)}; } }

  &__top { display: flex; align-items: center; gap: 12px; }
  &__icon { flex: none; width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; background: var(--st-soft); color: var(--st); }
  &__title { flex: 1; min-width: 0; }
  &__name { font: 600 19px/1.15 $font-display; letter-spacing: -0.02em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  &__type { font-size: 12px; color: $text-muted; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  &__edit { opacity: 0; border: 0; transition: opacity .15s; }
  &__meta { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: -2px; }

  &__guest { min-height: 64px; padding: 10px 12px; border-radius: 12px; background: $surface-2; display: flex; flex-direction: column; justify-content: center; gap: 10px; font-size: 13px;
    &--empty { flex-direction: row; align-items: center; justify-content: flex-start; gap: 8px; color: $text-muted; background: transparent; border: 1px dashed $border-strong; }
  }
  &__foot { margin-top: auto; padding-top: 2px; }
  &__price { white-space: nowrap; font-weight: 600; font-size: 14px; span { font-weight: 400; font-size: 12px; color: $text-muted; } }
  &__actions { display: flex; gap: 8px; > .btn { flex: 1; justify-content: center; } }
}
.guest {
  display: flex; align-items: center; gap: 10px; min-width: 0;
  &__av { flex: none; width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; font-size: 12px; font-weight: 600;
    background: var(--st); color: #fff;
    &--soft { background: var(--st-soft); color: var(--st); } }
  &__txt { min-width: 0; display: flex; flex-direction: column; line-height: 1.3;
    b { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    small { font-size: 12px; color: $text-muted; } }
  &__kicker { color: var(--st) !important; font-weight: 600; font-size: 11px !important; }
}
.stay {
  &__bar { height: 4px; border-radius: 99px; background: $fill-2; overflow: hidden;
    span { display: block; height: 100%; border-radius: inherit; background: var(--st); transition: width .6s $ease-out; } }
  &__txt { display: flex; justify-content: space-between; margin-top: 5px; font-size: 11px; color: $text-muted; font-variant-numeric: tabular-nums; }
  &__due { color: $danger; font-weight: 600; }
}
.today {
  position: sticky; top: calc(#{$topbar-h} + 16px);
  &__list { max-height: 320px; overflow-y: auto; }
  &__item { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 20px; border-bottom: 1px solid $border; font-size: 13px; &:last-child { border-bottom: 0; } }
  &__empty { padding: 20px; text-align: center; }
}
@media (max-width: 1200px) { .rooms-layout { grid-template-columns: 1fr; } .today { position: static; } }
@include mobile {
  .occ { padding: 16px; &__value { font-size: 30px; } }
  .status-filter { flex-wrap: nowrap; overflow-x: auto; margin: 0 -16px; padding: 0 16px; scrollbar-width: none; &::-webkit-scrollbar { display: none; } .sf { flex: none; } }
  .room-grid { grid-template-columns: 1fr; }
  .room__edit { opacity: 1; }
}
.room__price--custom { color: var(--warning); }
</style>
