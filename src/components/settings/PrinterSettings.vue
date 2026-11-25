<script setup>
/** Cài đặt máy in hoá đơn: chọn khổ giấy, cách kết nối máy in (riêng từng máy) + in thử */
import { ref, computed } from 'vue'
import Icon from '../ui/Icon.vue'
import { useSettings } from '../../stores/settings'
import { useUi } from '../../stores/ui'
import { PAPERS, printReceipt } from '../../utils/print'
import { MODES, supported, printerDevice, pickPrinter, forget, link } from '../../utils/printerLink'
import { fmtDateTime } from '../../utils/format'

const settings = useSettings()
const ui = useUi()
const testEl = ref(null)
const dev = printerDevice()
const direct = computed(() => dev.value.mode !== 'system')
const BAUDS = [9600, 19200, 38400, 115200]

function setMode(mode) {
  if (!supported[mode]) return
  if (mode === dev.value.mode) return
  forget()
  dev.value = { ...dev.value, mode, label: '', usb: null, serial: null }
}
// Phải gọi ngay trong lúc bấm nút: trình duyệt mới cho mở hộp chọn thiết bị
async function pick() {
  try {
    await pickPrinter(dev.value.mode)
    ui.toast(`Đã kết nối ${dev.value.label}`)
  } catch (e) {
    if (e?.name === 'NotFoundError') return // bấm Huỷ trong hộp chọn
    const hint = e?.name === 'SecurityError' || e?.name === 'NetworkError'
      ? ' — trên Windows, máy in USB đang dùng driver riêng: hãy dùng "Hộp thoại in" hoặc "Cổng COM"' : ''
    ui.toast(`Không kết nối được: ${e?.message || e}${hint}`, 'error')
  }
}
async function unlink() {
  await forget()
  dev.value = { ...dev.value, label: '', usb: null, serial: null }
}
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

      <div class="printer-set__label">Kết nối máy in <span class="muted">(riêng máy này)</span></div>
      <div class="printer-set__modes segmented segmented--full" role="radiogroup" aria-label="Cách kết nối máy in">
        <button
          v-for="(m, key) in MODES" :key="key" type="button" role="radio"
          :aria-checked="dev.mode === key" :class="{ active: dev.mode === key }" :disabled="!supported[key]"
          :title="supported[key] ? m.hint : 'Trình duyệt này không hỗ trợ — dùng Chrome/Edge'" @click="setMode(key)"
        ><Icon :name="m.icon" :size="14" />{{ m.label }}</button>
      </div>
      <p class="muted printer-set__hint">{{ MODES[dev.mode]?.hint }}<template v-if="!supported.usb && !supported.bluetooth"> · Trình duyệt này chỉ in được qua hộp thoại in (iPhone/Safari không hỗ trợ kết nối trực tiếp).</template></p>

      <template v-if="direct">
        <p v-if="settings.printer.paper === 'a4'" class="printer-set__warn">Kết nối trực tiếp chỉ dùng cho máy in nhiệt K80/K58 — khổ A4 vẫn in qua hộp thoại in.</p>
        <div class="printer-set__device">
          <span class="printer-set__dot" :class="{ on: dev.label && link.connected }"></span>
          <div class="printer-set__devname">
            <b>{{ dev.label || 'Chưa chọn máy in' }}</b>
            <small v-if="dev.label">{{ link.connected ? 'Đã kết nối' : 'Sẽ tự kết nối khi in' }}</small>
          </div>
          <button type="button" class="btn btn--primary" @click="pick"><Icon name="fa-link" :size="14" />{{ dev.label ? 'Chọn lại' : 'Chọn máy in' }}</button>
          <button v-if="dev.label" type="button" class="btn btn--ghost" @click="unlink">Bỏ chọn</button>
        </div>
        <div class="printer-set__opts2">
          <div v-if="dev.mode === 'serial'" class="field">
            <label for="printer-baud">Tốc độ cổng (baud) — xem trên phiếu tự kiểm tra của máy in, thường là 9600</label>
            <select id="printer-baud" v-model.number="dev.baud" class="input input--sm" @change="forget()"><option v-for="b in BAUDS" :key="b" :value="b">{{ b }}</option></select>
          </div>
          <label class="switch-row">
            <span><b>Tự cắt giấy sau khi in</b><small>Tắt nếu máy in không có dao cắt.</small></span>
            <input v-model="dev.cut" type="checkbox" class="switch" />
          </label>
        </div>
      </template>

      <ul class="printer-set__tips muted">
        <li v-if="direct">In trực tiếp: bấm In là ra phiếu ngay, không hiện hộp thoại. Nếu máy in mất kết nối, app tự chuyển sang hộp thoại in.</li>
        <li v-if="dev.mode === 'usb'">Windows: nếu đã cài driver của máy in, Chrome thường không mở được cổng USB — dùng "Hộp thoại in", hoặc chọn máy in dạng cổng COM nếu máy có.</li>
        <li v-if="dev.mode === 'bluetooth'">Chỉ hỗ trợ máy in Bluetooth BLE (đa số máy in cầm tay 58 mm). Bật Bluetooth + vị trí trên điện thoại Android trước khi chọn máy in.</li>
        <li v-if="!direct">Khi hộp thoại in hiện ra: chọn đúng máy in hoá đơn, <b>Lề (Margins): Không có / None</b>, <b>Tỉ lệ (Scale): 100%</b>, tắt "Đầu trang và chân trang" (Headers and footers).</li>
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
  &__label { font-weight: 600; margin-top: 4px; }
  &__modes { width: 100%; button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; } button:disabled { opacity: .4; cursor: not-allowed; } }
  &__hint { margin: -6px 0 0; font-size: 13px; }
  &__warn { margin: 0; font-size: 13px; color: $warning; }
  &__device { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 12px; border-radius: 12px; box-shadow: inset 0 0 0 1px $border-strong; flex-wrap: wrap; }
  &__devname { flex: 1; min-width: 140px; display: flex; flex-direction: column; small { color: $text-2; font-size: 12px; } }
  &__dot { width: 9px; height: 9px; border-radius: 50%; background: $border-strong; &.on { background: $success; } }
  &__opts2 { display: flex; flex-direction: column; gap: 10px; width: 100%; }
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
