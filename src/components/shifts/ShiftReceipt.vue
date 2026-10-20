<script setup>
/** Phiếu chốt ca (khổ K80) */
import { computed } from 'vue'
import { useShifts, DENOMINATIONS } from '../../stores/shifts'
import { useSettings } from '../../stores/settings'
import { money, number, fmtDateTime } from '../../utils/format'

const props = defineProps({ shift: { type: Object, required: true } })
const shifts = useShifts()
const settings = useSettings()
const s = computed(() => shifts.byId?.(props.shift.id) || props.shift)
const sum = computed(() => shifts.summary(s.value))
</script>

<template>
  <div class="receipt print-area">
    <div class="receipt__shop"><strong>{{ settings.shop.name }}</strong><div>{{ settings.shop.address }}</div></div>
    <div class="receipt__title">PHIẾU CHỐT CA {{ s.code }}</div>
    <div class="receipt__meta">
      <div><span>Mở:</span> {{ s.userName }} · {{ fmtDateTime(s.openedAt) }}</div>
      <div v-if="s.closedAt"><span>Đóng:</span> {{ s.closedByName }} · {{ fmtDateTime(s.closedAt) }}</div>
    </div>
    <div class="receipt__sum">
      <div><span>Số hoá đơn</span><b>{{ sum.count }}</b></div>
      <div><span>Tiền mặt</span><b>{{ money(sum.cash) }}</b></div>
      <div><span>Chuyển khoản</span><b>{{ money(sum.transfer) }}</b></div>
      <div><span>Thẻ</span><b>{{ money(sum.card) }}</b></div>
      <div class="grand"><span>Doanh thu</span><b>{{ money(sum.revenue) }}</b></div>
      <div><span>Tiền đầu ca</span><b>{{ money(s.openingCash) }}</b></div>
      <div><span>Két dự kiến</span><b>{{ money(s.expectedCash ?? sum.expectedCash) }}</b></div>
      <template v-if="s.closedAt">
        <div><span>Đếm được</span><b>{{ money(s.countedCash) }}</b></div>
        <div class="grand"><span>Chênh lệch</span><b>{{ (s.diff > 0 ? '+' : '') + money(s.diff) }}</b></div>
      </template>
    </div>
    <table v-if="s.counts">
      <thead><tr><th>Mệnh giá</th><th class="r">Số tờ</th><th class="r">Thành tiền</th></tr></thead>
      <tbody>
        <tr v-for="d in DENOMINATIONS.filter((d) => s.counts[d])" :key="d">
          <td>{{ number(d) }}</td><td class="r">{{ s.counts[d] }}</td><td class="r">{{ number(d * s.counts[d]) }}</td>
        </tr>
      </tbody>
    </table>
    <p v-if="s.closeNote" style="margin-top: 10px">Ghi chú: {{ s.closeNote }}</p>
    <div class="receipt__foot">Người đóng ca ký tên: ..................</div>
  </div>
</template>
