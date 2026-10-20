<script setup>
/**
 * PHIẾU TỔNG KẾT NGÀY (khổ K80): gộp mọi hoá đơn trong ngày, mọi ca.
 * - Doanh thu theo hình thức thanh toán, theo loại (bán hàng / tiền phòng)
 * - Danh sách món đã bán (gộp số lượng)
 * - Các ca trong ngày + két lệch
 */
import { computed } from 'vue'
import { useInvoices, PAY_METHODS } from '../../stores/invoices'
import { useShifts } from '../../stores/shifts'
import { useSettings } from '../../stores/settings'
import { useAuth } from '../../stores/auth'
import { money, number, fmtDate, fmtTime, fmtDateTime, dateKey, weekday } from '../../utils/format'

const props = defineProps({ date: { type: String, required: true } }) // 'YYYY-MM-DD'
const invoices = useInvoices()
const shifts = useShifts()
const settings = useSettings()
const auth = useAuth()

const dayInv = computed(() => invoices.items.filter((i) => dateKey(i.createdAt) === props.date))
const done = computed(() => dayInv.value.filter((i) => i.status === 'completed'))
const cancelled = computed(() => dayInv.value.filter((i) => i.status !== 'completed'))
const sumBy = (list, f) => list.reduce((s, i) => s + f(i), 0)

const t = computed(() => {
  const d = done.value
  const byMethod = Object.fromEntries(Object.keys(PAY_METHODS).map((m) => [m, sumBy(d.filter((i) => i.method === m), (i) => i.total)]))
  return {
    count: d.length,
    subtotal: sumBy(d, (i) => i.subtotal),
    discount: sumBy(d, (i) => i.discount),
    revenue: sumBy(d, (i) => i.total),
    retail: sumBy(d.filter((i) => i.type !== 'room'), (i) => i.total),
    room: sumBy(d.filter((i) => i.type === 'room'), (i) => i.total),
    byMethod,
    cancelledTotal: sumBy(cancelled.value, (i) => i.total),
  }
})

// Gộp món đã bán theo tên, nhiều nhất lên trước
const lines = computed(() => {
  const m = new Map()
  done.value.forEach((inv) => inv.items.forEach((l) => {
    const k = l.productId || l.name
    const cur = m.get(k) || { name: l.name, qty: 0, amount: 0 }
    cur.qty += l.qty; cur.amount += l.price * l.qty
    m.set(k, cur)
  }))
  return [...m.values()].sort((a, b) => b.amount - a.amount)
})

const dayShifts = computed(() => shifts.items.filter((s) => dateKey(s.openedAt) === props.date).slice().sort((a, b) => a.openedAt.localeCompare(b.openedAt)))
const diffTotal = computed(() => sumBy(dayShifts.value.filter((s) => s.status === 'closed'), (s) => s.diff || 0))
const printedAt = new Date()
</script>

<template>
  <div class="receipt print-area day-receipt">
    <div class="receipt__shop">
      <strong>{{ settings.shop.name }}</strong>
      <div>{{ settings.shop.address }}</div>
      <div v-if="settings.shop.phone">ĐT: {{ settings.shop.phone }}</div>
    </div>
    <div class="receipt__title">TỔNG KẾT NGÀY</div>
    <div class="day-receipt__date">{{ weekday(date) }}, {{ fmtDate(date) }}</div>

    <div class="receipt__sum">
      <div><span>Số hoá đơn</span><b>{{ t.count }}</b></div>
      <div v-if="cancelled.length"><span>Hoá đơn huỷ</span><b>{{ cancelled.length }} ({{ number(t.cancelledTotal) }})</b></div>
      <div><span>Tiền hàng</span><b>{{ money(t.subtotal) }}</b></div>
      <div v-if="t.discount"><span>Giảm giá</span><b>-{{ money(t.discount) }}</b></div>
      <div class="grand"><span>DOANH THU</span><b>{{ money(t.revenue) }}</b></div>
    </div>

    <div class="day-receipt__sec">Theo hình thức thanh toán</div>
    <div class="receipt__sum">
      <div v-for="(label, k) in PAY_METHODS" :key="k"><span>{{ label }}</span><b>{{ money(t.byMethod[k]) }}</b></div>
    </div>

    <div class="day-receipt__sec">Theo loại</div>
    <div class="receipt__sum">
      <div><span>Bán hàng (café, đồ ăn…)</span><b>{{ money(t.retail) }}</b></div>
      <div><span>Tiền phòng</span><b>{{ money(t.room) }}</b></div>
    </div>

    <table v-if="lines.length">
      <thead><tr><th>Món / dịch vụ</th><th class="r">SL</th><th class="r">Thành tiền</th></tr></thead>
      <tbody>
        <tr v-for="l in lines" :key="l.name"><td>{{ l.name }}</td><td class="r">{{ l.qty }}</td><td class="r">{{ number(l.amount) }}</td></tr>
      </tbody>
    </table>

    <template v-if="dayShifts.length">
      <div class="day-receipt__sec">Ca làm việc</div>
      <table>
        <thead><tr><th>Ca</th><th>Giờ</th><th class="r">Doanh thu</th><th class="r">Lệch</th></tr></thead>
        <tbody>
          <tr v-for="s in dayShifts" :key="s.id">
            <td>{{ s.code }}<div class="sub">{{ s.userName }}</div></td>
            <td>{{ fmtTime(s.openedAt) }}–{{ s.closedAt ? fmtTime(s.closedAt) : 'đang mở' }}</td>
            <td class="r">{{ number(s.status === 'closed' ? s.revenue : shifts.summary(s).revenue) }}</td>
            <td class="r">{{ s.status === 'closed' ? (s.diff > 0 ? '+' : '') + number(s.diff || 0) : '—' }}</td>
          </tr>
        </tbody>
      </table>
      <div class="receipt__sum" style="border-top: 0; padding-top: 0">
        <div><span>Tổng lệch két</span><b>{{ (diffTotal > 0 ? '+' : '') + money(diffTotal) }}</b></div>
      </div>
    </template>

    <div class="receipt__foot">In lúc {{ fmtDateTime(printedAt) }} · {{ auth.user?.name }}<br />Người kiểm tra ký tên: ..................</div>
  </div>
</template>

<style lang="scss">
.day-receipt {
  &__date { text-align: center; margin: -4px 0 10px; text-transform: capitalize; }
  &__sec { margin: 10px 0 2px; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
}
</style>
