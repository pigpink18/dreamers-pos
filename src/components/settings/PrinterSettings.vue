<script setup>
/** Cài đặt máy in hoá đơn: chọn khổ giấy + in thử */
import { ref } from 'vue'
import Icon from '../ui/Icon.vue'
import { useSettings } from '../../stores/settings'
import { PAPERS, printReceipt } from '../../utils/print'
import { fmtDateTime } from '../../utils/format'

const settings = useSettings()
const testEl = ref(null)
const OPTIONS = [
  { key: '80', hint: 'Phổ biến nhất — cuộn giấy rộng 8 cm (Xprinter, Epson TM-T82, Rongta...)' },
  { key: '58', hint: 'Máy in nhỏ / máy in cầm tay — cuộn giấy rộng 5,8 cm' },
  { key: 'a4', hint: 'Máy in văn phòng thường (giấy A4)' },
]
</script>

<template>
  <section class="card mt-16">
    <div class="card__header"><h3>Máy in hoá đơn</h3><span class="muted">Áp dụng cho hoá đơn, phiếu chốt ca, tổng kết ngày</span></div>
    <div class="card__body printer-set">
      <div class="printer-set__opts" role="radiogroup" aria-label="Khổ giấy">
        <button
          v-for="o in OPTIONS" :key="o.key" type="button" class="paper-opt" role="radio"
          :aria-checked="settings.printer.paper === o.key" :class="{ active: settings.printer.paper === o.key }"
          @click="settings.printer.paper = o.key"
        >
          <span class="paper-opt__icon" :class="`paper-opt__icon--${o.key}`"></span>
          <b>{{ PAPERS[o.key].label }}</b>
          <small>{{ o.hint }}</small>
        </button>
      </div>
      <ul class="printer-set__tips muted">
        <li>Khi hộp thoại in hiện ra: chọn đúng máy in hoá đơn, <b>Lề (Margins): Không có / None</b>, <b>Tỉ lệ (Scale): 100%</b>, tắt "Đầu trang và chân trang" (Headers and footers).</li>
        <li>Máy in nhiệt chỉ in màu đen nên phiếu tự in chữ đen, không in hình nền của app.</li>
      </ul>
      <button type="button" class="btn btn--ghost" @click="printReceipt(testEl)"><Icon name="print" :size="15" />In thử</button>

      <!-- Phiếu in thử (ẩn) -->
      <div class="printer-set__hidden" aria-hidden="true">
        <div ref="testEl" class="receipt print-area">
          <div class="receipt__shop"><strong>{{ settings.shop.name }}</strong><div>{{ settings.shop.address }}</div></div>
          <div class="receipt__title">IN THỬ · {{ PAPERS[settings.printer.paper]?.label }}</div>
          <div class="receipt__sum">
            <div><span>Dòng chữ thường</span><b>12.345 ₫</b></div>
            <div><span>Tên món dài để thử xuống dòng xem có bị cắt chữ không</span><b>99.000 ₫</b></div>
            <div class="grand"><span>TỔNG CỘNG</span><b>111.345 ₫</b></div>
          </div>
          <div class="receipt__foot">Nếu chữ không bị cắt mép là đã cài đúng · {{ fmtDateTime(new Date().toISOString()) }}</div>
        </div>
      </div>
    </div>
  </section>
</template>

<style lang="scss">
@use '../../styles/tokens' as *;
.printer-set {
  display: flex; flex-direction: column; gap: 14px; align-items: flex-start;
  &__opts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; width: 100%; }
  &__tips { margin: 0; padding-left: 18px; font-size: 13px; line-height: 1.6; }
  &__hidden { position: absolute; width: 0; height: 0; overflow: hidden; }
}
.paper-opt {
  display: flex; flex-direction: column; align-items: flex-start; gap: 4px; padding: 12px; text-align: left;
  border: 0; border-radius: 12px; background: $surface; box-shadow: inset 0 0 0 1px $border-strong; font: inherit; color: $text; cursor: pointer;
  small { color: $text-2; font-size: 12px; line-height: 1.4; }
  &.active { box-shadow: inset 0 0 0 2px $primary; background: $primary-soft; }
  &__icon { display: block; height: 28px; border-radius: 3px; border: 1.5px solid currentColor; margin-bottom: 4px; opacity: .7;
    &--80 { width: 22px; } &--58 { width: 16px; } &--a4 { width: 22px; height: 30px; } }
}
@media (max-width: 640px) {
  .printer-set__opts { grid-template-columns: 1fr; gap: 8px; }
  .paper-opt { display: grid; grid-template-columns: 26px 1fr; column-gap: 12px; row-gap: 1px; align-items: center; padding: 10px 12px;
    .paper-opt__icon { grid-row: span 2; margin: 0; justify-self: center; } }
}
</style>
