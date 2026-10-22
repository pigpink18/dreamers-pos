<script setup>
import { transferTag } from '../../tenant'
/** Cài đặt tài khoản nhận chuyển khoản (VietQR) */
import { reactive } from 'vue'
import Icon from '../ui/Icon.vue'
import AppSelect from '../ui/AppSelect.vue'
import VietQrCard from '../payment/VietQrCard.vue'
import { useSettings } from '../../stores/settings'
import { useUi } from '../../stores/ui'
import { useAudit } from '../../stores/audit'
import { BANKS } from '../../utils/vietqr'

const settings = useSettings()
const ui = useUi()
const f = reactive({ bin: '', account: '', holder: '', qrOnReceipt: true, ...settings.payment })

function save() {
  if (f.account && !/^[0-9A-Za-z]{4,19}$/.test(f.account.replace(/\s/g, ''))) return ui.toast('Số tài khoản không hợp lệ', 'error')
  if (f.account && !f.bin) return ui.toast('Chọn ngân hàng', 'error')
  Object.assign(settings.payment, { ...f, account: f.account.replace(/\s/g, ''), holder: f.holder.trim() })
  useAudit().log('settings.update', 'Sửa tài khoản nhận chuyển khoản')
  ui.toast('Đã lưu tài khoản nhận chuyển khoản')
}
</script>

<template>
  <section class="card">
    <div class="card__header"><h3>Nhận chuyển khoản bằng VietQR</h3></div>
    <div class="card__body">
      <p class="muted" style="margin: 0 0 16px">Khi chọn "Chuyển khoản", màn hình bán hàng và hoá đơn sẽ hiện mã QR có sẵn <b>số tiền</b> và <b>mã hoá đơn</b>. Khách quét bằng bất kỳ app ngân hàng nào. Mã được tạo ngay trên máy, không cần mạng, không mất phí.</p>
      <form class="form-grid" @submit.prevent="save">
        <div class="field"><label>Ngân hàng</label>
          <AppSelect v-model="f.bin" :searchable="true" placeholder="Chọn ngân hàng" :options="BANKS.map((b) => ({ value: b.bin, label: b.name, sub: b.code }))" />
        </div>
        <div class="field"><label>Số tài khoản</label><input class="input num" v-model="f.account" inputmode="numeric" placeholder="VD: 0011001234567" /></div>
        <div class="field full"><label>Tên chủ tài khoản</label><input class="input" v-model="f.holder" placeholder="VD: NGUYEN THI YEN" /></div>
        <label class="switch-row full">
          <span><b>In mã QR trên hoá đơn chuyển khoản</b><small>Khách có thể quét ngay trên tờ hoá đơn.</small></span>
          <input type="checkbox" class="switch" v-model="f.qrOnReceipt" />
        </label>
        <div class="full"><button class="btn btn--primary"><Icon name="check" :size="15" />Lưu</button></div>
      </form>
      <div v-if="settings.payment.account" class="mt-16">
        <div class="eyebrow-s">Xem trước (50.000 ₫)</div>
        <VietQrCard :amount="50000" :note="`HD000001 ${transferTag(settings.shop.name)}`.trim()" :size="160" />
      </div>
      <p class="muted mt-16" style="font-size: 12px"><Icon name="fa-circle-info" :size="12" /> Hãy chuyển thử 1 lần từ điện thoại để chắc chắn số tài khoản đúng trước khi dùng với khách.</p>
    </div>
  </section>
</template>

<style lang="scss">
.eyebrow-s { font-size: 12px; font-weight: 600; color: var(--text-2); margin-bottom: 8px; }
</style>
