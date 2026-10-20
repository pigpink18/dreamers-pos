<script setup>
/** Xuất hoá đơn điện tử cho 1 hoá đơn: khách lẻ hoặc doanh nghiệp (có MST) */
import { reactive, ref, computed } from 'vue'
import BaseModal from '../ui/BaseModal.vue'
import Icon from '../ui/Icon.vue'
import { useInvoices } from '../../stores/invoices'
import { useSettings } from '../../stores/settings'
import { useUi } from '../../stores/ui'
import { issueEinvoice, splitVat, PROVIDERS } from '../../einvoice'
import { money } from '../../utils/format'

const props = defineProps({ invoiceId: String })
const emit = defineEmits(['close'])
const invoices = useInvoices()
const settings = useSettings()
const ui = useUi()
const inv = computed(() => invoices.byId(props.invoiceId))
const cfg = settings.einvoice
const kind = ref('individual')
const b = reactive({ name: inv.value?.customerName === 'Khách lẻ' ? '' : inv.value?.customerName || '', companyName: '', taxCode: '', address: '', email: '' })
const busy = ref(false)
const v = computed(() => splitVat(inv.value.total, +cfg.vatRate || 0))

async function submit() {
  if (kind.value === 'company') {
    if (!/^\d{10}(-\d{3})?$/.test(b.taxCode.trim())) return ui.toast('Mã số thuế gồm 10 số (hoặc 10 số-3 số)', 'error')
    if (!b.companyName.trim() || !b.address.trim()) return ui.toast('Nhập tên đơn vị và địa chỉ', 'error')
  }
  busy.value = true
  try {
    const r = await issueEinvoice(inv.value.id, kind.value === 'company' ? { ...b } : b.name || b.email ? { name: b.name, email: b.email } : null)
    ui.toast(`Đã xuất HĐĐT số ${r.number}${r.sandbox ? ' (thử nghiệm)' : ''}`)
    emit('close')
  } catch (e) {
    ui.toast('Xuất HĐĐT lỗi: ' + e.message, 'error')
  } finally { busy.value = false }
}
</script>

<template>
  <BaseModal :title="`Xuất HĐĐT · ${inv.code}`" width="480px" @close="emit('close')">
    <div class="einv-sum">
      <div><span>Nhà cung cấp</span><b>{{ PROVIDERS[cfg.provider] }}</b></div>
      <div><span>Tiền trước thuế</span><b class="num">{{ money(v.pre) }}</b></div>
      <div><span>Thuế GTGT {{ cfg.vatRate }}%</span><b class="num">{{ money(v.vat) }}</b></div>
      <div class="t"><span>Tổng thanh toán</span><b class="num">{{ money(inv.total) }}</b></div>
    </div>
    <div class="segmented segmented--full" style="margin: 16px 0">
      <button :class="{ active: kind === 'individual' }" @click="kind = 'individual'">Cá nhân / khách lẻ</button>
      <button :class="{ active: kind === 'company' }" @click="kind = 'company'">Doanh nghiệp (có MST)</button>
    </div>
    <div class="form-grid">
      <template v-if="kind === 'company'">
        <div class="field"><label>Mã số thuế *</label><input class="input num" v-model="b.taxCode" inputmode="numeric" placeholder="0312345678" /></div>
        <div class="field"><label>Người mua hàng</label><input class="input" v-model="b.name" /></div>
        <div class="field full"><label>Tên đơn vị *</label><input class="input" v-model="b.companyName" placeholder="CÔNG TY TNHH …" /></div>
        <div class="field full"><label>Địa chỉ *</label><input class="input" v-model="b.address" /></div>
      </template>
      <div v-else class="field full"><label>Họ tên người mua (không bắt buộc)</label><input class="input" v-model="b.name" placeholder="Để trống = Khách lẻ không lấy hoá đơn" /></div>
      <div class="field full"><label>Email nhận hoá đơn</label><input class="input" v-model="b.email" type="email" placeholder="khach@email.com" /></div>
    </div>
    <p v-if="cfg.provider === 'sandbox'" class="muted" style="font-size: 12px; margin-bottom: 0"><Icon name="fa-circle-info" :size="12" /> Đang ở chế độ thử nghiệm: số hoá đơn là giả lập, không gửi cơ quan thuế.</p>
    <template #footer>
      <button class="btn btn--ghost" @click="emit('close')">Huỷ</button>
      <button class="btn btn--primary" :disabled="busy" @click="submit"><Icon name="fa-file-invoice" :size="15" />{{ busy ? 'Đang xuất…' : 'Xuất hoá đơn điện tử' }}</button>
    </template>
  </BaseModal>
</template>

<style lang="scss">
@use '../../styles/tokens' as *;
.einv-sum { display: flex; flex-direction: column; gap: 6px; padding: 12px 14px; border-radius: 12px; background: $surface-2; border: 1px solid $border; font-size: 13px;
  div { display: flex; justify-content: space-between; gap: 12px; } span { color: $text-2; }
  .t { border-top: 1px solid $border; padding-top: 6px; margin-top: 2px; font-weight: 600; span { color: $text; } } }
</style>
