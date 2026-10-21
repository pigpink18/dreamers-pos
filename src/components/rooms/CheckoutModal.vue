<script setup>
import AppSelect from '../ui/AppSelect.vue'
import { ref, computed } from 'vue'
import BaseModal from '../ui/BaseModal.vue'
import Icon from '../ui/Icon.vue'
import { useRooms } from '../../stores/rooms'
import { useProducts } from '../../stores/products'
import { useUi } from '../../stores/ui'
import { useAuth } from '../../stores/auth'
import { useAudit } from '../../stores/audit'
import { PAY_METHODS } from '../../stores/invoices'
import VietQrCard from '../payment/VietQrCard.vue'
import { money, number, fmtDate, dateKey, diffDays } from '../../utils/format'
import DiscountInput from '../ui/DiscountInput.vue'
import RoomRateInput from './RoomRateInput.vue'

const props = defineProps({ bookingId: String })
const emit = defineEmits(['close', 'done'])
const rooms = useRooms()
const products = useProducts()
const ui = useUi()
const auth = useAuth()

const b = computed(() => rooms.bookingById(props.bookingId))
const room = computed(() => rooms.roomById(b.value.roomId))
const nights = computed(() => rooms.nightsFor(b.value))
// Giá đã thoả thuận lúc đặt phòng; sửa lại được ngay khi trả phòng
const agreed = computed(() => rooms.roomChargeFor(b.value, nights.value))
const price = ref({ priceMode: b.value?.priceMode || 'night', rate: rooms.rateOf(b.value), packagePrice: +b.value?.packagePrice || 0 })
const editPrice = ref(false)
const roomCharge = computed(() => rooms.roomChargeFor(price.value, nights.value))
const bookedNights = computed(() => Math.max(1, diffDays(b.value.checkIn, b.value.checkOut)))

// Dịch vụ / đồ dùng phát sinh trong thời gian ở
const extras = ref([])
const pickId = ref('')
function addExtra() {
  const p = products.byId(pickId.value)
  if (!p) return
  const ex = extras.value.find((e) => e.productId === p.id)
  if (p.trackStock !== false && (ex?.qty || 0) + 1 > (+p.stock || 0)) {
    setTimeout(() => (pickId.value = ''), 0)
    return ui.toast(`"${p.name}" chỉ còn ${p.stock} ${p.unit}`, 'error')
  }
  if (ex) ex.qty++
  else extras.value.push({ productId: p.id, name: p.name, price: p.price, cost: p.cost, qty: 1 })
  setTimeout(() => (pickId.value = ''), 0)
}
const extrasTotal = computed(() => extras.value.reduce((s, e) => s + e.price * e.qty, 0))
const discount = ref(0)
const method = ref('cash')
const total = computed(() => Math.max(0, roomCharge.value + extrasTotal.value - (+discount.value || 0)))
const due = computed(() => total.value - (b.value.deposit || 0))

async function confirm() {
  // Số lượng dịch vụ: số nguyên, không vượt tồn kho
  for (const e of extras.value) {
    e.qty = Math.max(0, Math.floor(+e.qty || 0))
    const p = products.byId(e.productId)
    if (p && p.trackStock !== false && e.qty > (+p.stock || 0)) return ui.toast(`"${p.name}" chỉ còn ${p.stock} ${p.unit}`, 'error')
  }
  // Thu tiền phòng cũng phải nằm trong một ca
  if (!(await ui.requireShift())) return
  // Giảm giá (kể cả hạ giá phòng so với giá đã thoả thuận) vượt mức cho phép -> cần duyệt
  const disc = +discount.value || 0
  const cut = Math.max(0, agreed.value - roomCharge.value) + disc
  const gross = agreed.value + extrasTotal.value
  const pct = gross ? Math.ceil((cut / gross) * 100) : 0
  if (cut > 0 && (!auth.can('pos.discount') || pct > auth.maxDiscount)) {
    const approver = await ui.approve({
      perm: 'pos.discount',
      reason: `Giảm ${money(cut)} (${pct}%) tiền phòng ${room.value.name}`,
      check: (u) => (auth.roleById(u.roleId)?.maxDiscount ?? 0) >= pct,
    })
    if (!approver) return
    useAudit().log('invoice.discount', `Giảm ${money(cut)} (${pct}%) khi trả phòng ${room.value.name}`, { approvedBy: approver })
  }
  let inv
  try { inv = rooms.checkOut(b.value.id, { extras: extras.value.filter((e) => e.qty > 0), discount: disc, method: method.value, price: { ...price.value } }) }
  catch (e) { return ui.toast(e.message, 'error') }
  ui.toast(`Đã trả phòng ${room.value.name} · ${inv.code}`)
  emit('done', inv)
  emit('close')
}
</script>

<template>
  <BaseModal v-if="b" :title="`Trả phòng ${room.name}`" width="620px" @close="emit('close')">
    <div class="co-head">
      <div><span class="muted">Khách</span><b>{{ b.guestName }}</b></div>
      <div><span class="muted">Nhận phòng</span><b>{{ fmtDate(b.checkIn) }}</b></div>
      <div><span class="muted">Trả phòng</span><b>{{ fmtDate(dateKey()) }}</b></div>
      <div><span class="muted">Số đêm</span><b>{{ nights }}</b></div>
    </div>

    <table class="table mt-16 co-table">
      <tbody>
        <tr>
          <td>
            <div class="co-room">
              <div>
                Tiền phòng {{ room.type }}
                <span v-if="price.priceMode === 'package'" class="muted">(trọn gói {{ nights }} đêm)</span>
                <span v-else class="muted num">({{ nights }} × {{ number(price.rate) }})</span>
                <span v-if="roomCharge !== nights * room.price" class="badge co-room__tag">Giá riêng</span>
              </div>
              <button type="button" class="btn btn--ghost btn--sm" @click="editPrice = !editPrice">
                <Icon :name="editPrice ? 'check' : 'edit'" :size="14" />{{ editPrice ? 'Xong' : 'Sửa giá' }}
              </button>
            </div>
            <div v-if="price.priceMode === 'package' && nights !== bookedNights" class="co-room__warn">
              Trọn gói đặt cho {{ bookedNights }} đêm, khách ở thực tế {{ nights }} đêm — kiểm tra lại giá.
            </div>
          </td>
          <td class="text-right num fw-600">{{ money(roomCharge) }}</td>
        </tr>
        <tr v-for="(e, i) in extras" :key="e.productId">
          <td>
            <div class="flex">
              {{ e.name }}
              <input class="input num" type="number" min="0" step="1" inputmode="numeric" v-model.number="e.qty" style="width: 70px; height: 30px" />
              <span class="muted">× {{ number(e.price) }}</span>
              <button class="btn btn--ghost btn--icon btn--sm" @click="extras.splice(i, 1)" aria-label="Bỏ"><Icon name="x" :size="14" /></button>
            </div>
          </td>
          <td class="text-right num">{{ money(e.price * e.qty) }}</td>
        </tr>
      </tbody>
    </table>
    <RoomRateInput
      v-if="editPrice" class="mt-16"
      :list-price="room.price" :nights="nights"
      v-model:mode="price.priceMode" v-model:rate="price.rate" v-model:pkg="price.packagePrice"
    />
    <div class="flex mt-16 co-pick">
      <AppSelect
        v-model="pickId" @change="addExtra" style="flex: 1" :searchable="true"
        placeholder="+ Thêm dịch vụ / đồ dùng phát sinh (minibar, giặt ủi, thuê xe...)"
        :options="products.active.map((p) => ({ value: p.id, label: p.name, sub: number(p.price) }))"
      />
    </div>

    <div class="co-sum">
      <div class="row"><span>Giảm giá</span><DiscountInput v-model="discount" :base="roomCharge + extrasTotal" /></div>
      <div class="row"><span>Tổng cộng</span><b class="num">{{ money(total) }}</b></div>
      <div class="row" v-if="b.deposit"><span>Đã đặt cọc</span><b class="num text-success">− {{ money(b.deposit) }}</b></div>
      <div v-if="due >= 0" class="row big"><span>Khách cần trả thêm</span><b class="num">{{ money(due) }}</b></div>
      <div v-else class="row big"><span>Hoàn lại khách (cọc dư)</span><b class="num text-danger">{{ money(-due) }}</b></div>
      <div class="segmented segmented--full">
        <button v-for="(l, k) in PAY_METHODS" :key="k" :class="{ active: method === k }" @click="method = k">{{ l }}</button>
      </div>
      <VietQrCard v-if="method === 'transfer' && due > 0" :amount="due" :note="`${b.code} ${b.guestName}`" :size="150" />
    </div>

    <template #footer>
      <button class="btn btn--ghost" @click="emit('close')">Huỷ</button>
      <button class="btn btn--success" @click="confirm"><Icon name="logout" :size="16" />Xác nhận trả phòng & xuất hoá đơn</button>
    </template>
  </BaseModal>
</template>

<style lang="scss">
.co-head {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; padding: 14px; border-radius: 12px; background: var(--surface-2); border: 1px solid var(--border);
  div { display: flex; flex-direction: column; } span { font-size: 12px; }
}
.co-sum {
  margin-top: 16px; display: flex; flex-direction: column; gap: 10px;
  .row { display: flex; justify-content: space-between; align-items: center; }
  .big { font-size: 17px; b { font-size: 22px; color: var(--primary); } }
}
.segmented--full { display: flex; button { flex: 1; } }
.co-table { table-layout: fixed; width: 100%; td:last-child { width: 120px; white-space: nowrap; } }
.co-pick { min-width: 0; > * { min-width: 0; } }
@media (max-width: 640px) {
  .co-head { grid-template-columns: 1fr 1fr; }
  .co-table td:last-child { width: 100px; }
  .co-room { flex-wrap: wrap; }
}
.co-room {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  &__tag { margin-left: 6px; background: var(--warning-soft); color: var(--warning); }
  &__warn { margin-top: 6px; font-size: 12px; color: var(--warning); }
}
</style>
