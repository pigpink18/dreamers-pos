<script setup>
/** Cài đặt hoá đơn điện tử */
import { reactive, computed } from 'vue'
import Icon from '../ui/Icon.vue'
import AppSelect from '../ui/AppSelect.vue'
import { useSettings } from '../../stores/settings'
import { useUi } from '../../stores/ui'
import { useAudit } from '../../stores/audit'
import { PROVIDERS } from '../../einvoice'
import { sync } from '../../sync/engine'

const settings = useSettings()
const ui = useUi()
const f = reactive({ ...settings.einvoice })
const real = computed(() => ['misa', 'viettel', 'vnpt'].includes(f.provider))

function save() {
  if (f.provider !== 'none' && f.provider !== 'sandbox') {
    if (!/^\d{10}(-\d{3})?$/.test((f.taxCode || '').trim())) return ui.toast('Mã số thuế người bán không hợp lệ', 'error')
    if (!f.series.trim()) return ui.toast('Nhập ký hiệu hoá đơn (do nhà cung cấp cấp)', 'error')
  }
  Object.assign(settings.einvoice, { ...f, vatRate: +f.vatRate || 0 })
  useAudit().log('settings.update', `Cài đặt HĐĐT: ${PROVIDERS[f.provider]}`)
  ui.toast('Đã lưu cài đặt hoá đơn điện tử')
}
</script>

<template>
  <section class="card">
    <div class="card__header"><h3>Hoá đơn điện tử</h3></div>
    <div class="card__body">
      <p class="muted" style="margin: 0 0 16px">
        Xuất HĐĐT từ máy tính tiền qua nhà cung cấp (MISA, Viettel, VNPT). Khi chưa có hợp đồng, chọn <b>Thử nghiệm</b> để chạy thử toàn bộ quy trình — số hoá đơn là giả lập, không gửi cơ quan thuế.
        Quán có thuộc diện bắt buộc dùng HĐĐT khởi tạo từ máy tính tiền hay không, mức thuế suất áp dụng — nên hỏi kế toán hoặc chi cục thuế.
      </p>
      <form class="form-grid" @submit.prevent="save">
        <div class="field full"><label>Nhà cung cấp</label>
          <AppSelect v-model="f.provider" :options="Object.entries(PROVIDERS).map(([value, label]) => ({ value, label }))" />
        </div>
        <template v-if="f.provider !== 'none'">
          <div class="field"><label>Mã số thuế người bán</label><input class="input num" v-model="f.taxCode" inputmode="numeric" placeholder="10 số" /></div>
          <div class="field"><label>Thuế suất GTGT (%)</label><input class="input num" type="number" min="0" max="10" v-model="f.vatRate" /></div>
          <div class="field full"><label>Tên người bán trên hoá đơn</label><input class="input" v-model="f.sellerName" placeholder="Hộ kinh doanh / Công ty …" /></div>
          <div class="field"><label>Mẫu số</label><input class="input" v-model="f.templateCode" placeholder="VD: 1" /></div>
          <div class="field"><label>Ký hiệu hoá đơn</label><input class="input" v-model="f.series" placeholder="VD: 1C26MDW" /></div>
          <div v-if="real" class="field full"><label>Tài khoản API (nhà cung cấp cấp)</label><input class="input" v-model="f.username" autocomplete="off" /></div>
          <label class="switch-row full">
            <span><b>Tự xuất HĐĐT sau mỗi lần thanh toán</b><small>Không cần bấm tay. Nếu lỗi (VD mất mạng), hoá đơn hiện "Xuất HĐĐT lỗi" để xuất lại.</small></span>
            <input type="checkbox" class="switch" v-model="f.autoIssue" />
          </label>
        </template>
        <div class="full"><button class="btn btn--primary"><Icon name="check" :size="15" />Lưu</button></div>
      </form>

      <div v-if="real" class="einv-note" :class="{ ok: sync.status.state === 'online' }">
        <Icon :name="sync.status.state === 'online' ? 'fa-cloud' : 'fa-circle-info'" :size="16" />
        <div>
          <b>Cần máy chủ để xuất HĐĐT thật</b>
          <small>
            Mật khẩu API được lưu an toàn trên máy chủ (Supabase secret), không lưu trên máy bán hàng.
            Làm theo mục "Hoá đơn điện tử" trong <code>supabase/HUONG-DAN.md</code> sau khi ký hợp đồng với nhà cung cấp.
            {{ sync.status.state === 'online' ? 'Máy chủ: đã kết nối.' : 'Máy chủ: chưa kết nối (Cài đặt › Đồng bộ).' }}
          </small>
        </div>
      </div>
    </div>
  </section>
</template>

<style lang="scss">
@use '../../styles/tokens' as *;
.einv-note { display: flex; gap: 12px; margin-top: 16px; padding: 12px 14px; border-radius: 12px; background: $warning-soft; color: $warning;
  div { display: flex; flex-direction: column; gap: 3px; } small { color: $text-2; line-height: 1.5; }
  &.ok { background: $success-soft; color: $success; } }
</style>
