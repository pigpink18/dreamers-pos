<script setup>
/**
 * PHIẾU CHỐT CA (in máy in nhiệt K80 / K58)
 * Doanh thu ca · tiền thu theo hình thức · két tiền mặt (dự kiến / đếm được / lệch) · danh sách hoá đơn trong ca
 */
import { computed } from 'vue'
import { useShifts, DENOMINATIONS } from '../../stores/shifts'
import { useSettings } from '../../stores/settings'
import { useInvoices, PAY_METHODS } from '../../stores/invoices'
import { money, number, fmtDateTime, fmtTime } from '../../utils/format'

const props = defineProps({ shift: { type: Object, required: true } })
const shifts = useShifts()
const settings = useSettings()
const invoices = useInvoices()
const s = computed(() => shifts.byId?.(props.shift.id) || props.shift)
const sum = computed(() => shifts.summary(s.value))
const collected = computed(() => sum.value.cash + sum.value.transfer + sum.value.card)
const list = computed(() =>
  invoices.items.filter((i) => i.shiftId === s.value.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
)
const SHORT = { cash: 'TM', transfer: 'CK', card: 'Thẻ' }
const printedAt = computed(() => fmtDateTime(new Date().toISOString()))
</script>

<template>
  <div class="receipt print-area shift-receipt">
    <div class="receipt__shop">
      <strong>{{ settings.shop.name }}</strong>
      <div>{{ settings.shop.address }}</div>
    </div>
    <div class="receipt__title">PHIẾU CHỐT CA {{ s.code }}</div>
    <div class="receipt__meta">
      <div><span>Mở ca:</span> {{ s.userName }} · {{ fmtDateTime(s.openedAt) }}</div>
      <div v-if="s.closedAt"><span>Đóng ca:</span> {{ s.closedByName }} · {{ fmtDateTime(s.closedAt) }}</div>
      <div v-else><span>Trạng thái:</span> ĐANG MỞ (tạm tính)</div>
    </div>

    <div class="rc-sec">DOANH THU</div>
    <div class="receipt__sum">
      <div><span>Số hoá đơn</span><b>{{ sum.count }}<template v-if="sum.cancelled"> (+{{ sum.cancelled }} huỷ)</template></b></div>
      <div><span>Bán hàng</span><b>{{ money(sum.retail) }}</b></div>
      <div v-if="sum.room"><span>Tiền phòng</span><b>{{ money(sum.room) }}</b></div>
      <div v-if="sum.discount"><span>Đã giảm giá</span><b>-{{ money(sum.discount) }}</b></div>
      <div class="grand"><span>TỔNG DOANH THU</span><b>{{ money(sum.revenue) }}</b></div>
    </div>

    <div class="rc-sec">TIỀN THU TRONG CA</div>
    <div class="receipt__sum">
      <div><span>Tiền mặt</span><b>{{ money(sum.cash) }}</b></div>
      <div><span>Chuyển khoản</span><b>{{ money(sum.transfer) }}</b></div>
      <div><span>Thẻ</span><b>{{ money(sum.card) }}</b></div>
      <div v-if="sum.deposits" class="rc-note"><span>(Cọc phòng đã thu trước)</span><b>{{ money(sum.deposits) }}</b></div>
      <div class="grand"><span>TỔNG THU</span><b>{{ money(collected) }}</b></div>
    </div>

    <div class="rc-sec">KÉT TIỀN MẶT</div>
    <div class="receipt__sum">
      <div><span>Tiền đầu ca</span><b>{{ money(s.openingCash) }}</b></div>
      <div><span>+ Tiền mặt bán được</span><b>{{ money(sum.cash) }}</b></div>
      <div><span>= Két dự kiến</span><b>{{ money(s.expectedCash ?? sum.expectedCash) }}</b></div>
      <template v-if="s.closedAt">
        <div><span>Đếm được</span><b>{{ money(s.countedCash) }}</b></div>
        <div class="grand">
          <span>{{ s.diff > 0 ? 'THỪA' : s.diff < 0 ? 'THIẾU' : 'KHỚP KÉT' }}</span>
          <b>{{ s.diff ? (s.diff > 0 ? '+' : '') + money(s.diff) : '0 ₫' }}</b>
        </div>
      </template>
    </div>
    <table v-if="s.counts && DENOMINATIONS.some((d) => s.counts[d])">
      <thead><tr><th>Mệnh giá</th><th class="r">Số tờ</th><th class="r">Thành tiền</th></tr></thead>
      <tbody>
        <tr v-for="d in DENOMINATIONS.filter((d) => s.counts[d])" :key="d">
          <td>{{ number(d) }}</td><td class="r">{{ s.counts[d] }}</td><td class="r">{{ number(d * s.counts[d]) }}</td>
        </tr>
      </tbody>
    </table>

    <template v-if="list.length">
      <div class="rc-sec">HOÁ ĐƠN TRONG CA</div>
      <table class="rc-list">
        <thead><tr><th>Mã · giờ</th><th>HT</th><th class="r">Tiền</th></tr></thead>
        <tbody>
          <tr v-for="i in list" :key="i.id" :class="{ void: i.status !== 'completed' }">
            <td>{{ i.code }} <span class="sub">{{ fmtTime(i.createdAt) }}</span></td>
            <td>{{ i.status !== 'completed' ? 'Huỷ' : SHORT[i.method] || PAY_METHODS[i.method] }}</td>
            <td class="r">{{ number(i.total) }}</td>
          </tr>
        </tbody>
      </table>
    </template>

    <p v-if="s.closeNote || s.note" class="rc-text">Ghi chú: {{ s.closeNote || s.note }}</p>
    <div class="rc-sign">
      <div>Người giao ca<br /><br /><br />{{ s.closedByName || s.userName }}</div>
      <div>Người nhận ca<br /><br /><br />..................</div>
    </div>
    <div class="receipt__foot">In lúc {{ printedAt }}</div>
  </div>
</template>

<style lang="scss">
.shift-receipt {
  .rc-sec { margin: 12px 0 2px; padding-top: 6px; border-top: 1px dashed #999; font-weight: 700; font-size: 11px; letter-spacing: .06em; }
  .rc-sec + .receipt__sum { border-top: 0; padding-top: 0; }
  .rc-note { font-size: 11px; color: #555; }
  .rc-list { td { padding: 3px 0; } .void td { text-decoration: line-through; } td:nth-child(2) { width: 34px; } }
  .rc-text { margin-top: 10px; }
  .rc-sign { display: flex; justify-content: space-between; gap: 10px; margin-top: 14px; text-align: center; font-size: 11px; > div { flex: 1; } }
}
</style>
