<script setup>
// Mẫu in hoá đơn khổ K80 (máy in nhiệt). Dùng chung cho POS, danh sách hoá đơn, trả phòng.
import { money, fmtDateTime, number } from '../../utils/format'
import { useSettings } from '../../stores/settings'
import { PAY_METHODS } from '../../stores/invoices'
import VietQrCard from '../payment/VietQrCard.vue'

defineProps({ invoice: { type: Object, required: true } })
const settings = useSettings()
</script>

<template>
  <div class="receipt print-area">
    <div class="receipt__shop">
      <strong>{{ settings.shop.name }}</strong>
      <div>{{ settings.shop.address }}</div>
      <div>ĐT: {{ settings.shop.phone }}</div>
    </div>
    <div class="receipt__title">HOÁ ĐƠN {{ invoice.type === 'room' ? 'TIỀN PHÒNG' : 'BÁN HÀNG' }}</div>
    <div class="receipt__meta">
      <div><span>Số:</span> {{ invoice.code }}</div>
      <div><span>Ngày:</span> {{ fmtDateTime(invoice.createdAt) }}</div>
      <div><span>Khách:</span> {{ invoice.customerName }}</div>
    </div>
    <table>
      <thead><tr><th>Mặt hàng</th><th class="r">SL</th><th class="r">T.Tiền</th></tr></thead>
      <tbody>
        <tr v-for="(l, i) in invoice.items" :key="i">
          <td>{{ l.name }}<div class="sub">{{ number(l.price) }}</div></td>
          <td class="r">{{ l.qty }}</td>
          <td class="r">{{ number(l.price * l.qty) }}</td>
        </tr>
      </tbody>
    </table>
    <div class="receipt__sum">
      <div><span>Tổng tiền hàng</span><b>{{ money(invoice.subtotal) }}</b></div>
      <div v-if="invoice.discount"><span>Giảm giá</span><b>-{{ money(invoice.discount) }}</b></div>
      <div class="grand"><span>Thanh toán</span><b>{{ money(invoice.total) }}</b></div>
      <div v-if="invoice.deposit"><span>Đã đặt cọc</span><b>-{{ money(invoice.deposit) }}</b></div>
      <div v-if="invoice.deposit && invoice.total >= invoice.deposit" class="grand"><span>Còn phải trả</span><b>{{ money(invoice.total - invoice.deposit) }}</b></div>
      <div v-if="invoice.deposit && invoice.total < invoice.deposit" class="grand"><span>Hoàn lại khách</span><b>{{ money(invoice.deposit - invoice.total) }}</b></div>
      <div><span>Hình thức</span><b>{{ PAY_METHODS[invoice.method] }}</b></div>
      <div v-if="invoice.paid > invoice.total"><span>Khách đưa</span><b>{{ money(invoice.paid) }}</b></div>
      <div v-if="invoice.paid > invoice.total"><span>Tiền thừa</span><b>{{ money(invoice.paid - invoice.total) }}</b></div>
    </div>
    <VietQrCard
      v-if="invoice.method === 'transfer' && invoice.status !== 'cancelled' && settings.payment.qrOnReceipt && invoice.total - (invoice.deposit || 0) > 0"
      compact :amount="invoice.total - (invoice.deposit || 0)" :note="`${invoice.code} Dreamers`"
    />
    <div v-if="invoice.status === 'cancelled'" class="receipt__void">ĐÃ HUỶ</div>
    <div class="receipt__foot">{{ settings.shop.footer }}</div>
  </div>
</template>
