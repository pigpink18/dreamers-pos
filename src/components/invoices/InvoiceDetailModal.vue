<script setup>
import { ref, computed, onMounted } from 'vue'
import BaseModal from '../ui/BaseModal.vue'
import Icon from '../ui/Icon.vue'
import InvoicePrint from './InvoicePrint.vue'
import EinvoiceModal from './EinvoiceModal.vue'
import { useSettings } from '../../stores/settings'
import { EINV_STATUS, PROVIDERS } from '../../einvoice'
import { useInvoices } from '../../stores/invoices'
import { useShifts } from '../../stores/shifts'
import { useUi } from '../../stores/ui'
import { fmtDateTime } from '../../utils/format'

const props = defineProps({ invoiceId: String, autoPrint: Boolean })
const emit = defineEmits(['close'])
const invoices = useInvoices()
const shifts = useShifts()
const ui = useUi()
const inv = computed(() => invoices.byId(props.invoiceId))
const shiftCode = computed(() => shifts.byId(inv.value?.shiftId)?.code)

const settings = useSettings()
const einvOn = computed(() => settings.einvoice.provider && settings.einvoice.provider !== 'none')
const einvOpen = ref(false)
const print = () => window.print()
onMounted(() => props.autoPrint && setTimeout(print, 300))

// Huỷ hoá đơn: bắt buộc ghi lý do + người có quyền "Huỷ hoá đơn" duyệt
const cancelling = ref(false)
const REASONS = ['Khách đổi món', 'Nhập nhầm', 'Khách không thanh toán', 'Trùng hoá đơn']
const reason = ref('')
async function confirmCancel() {
  if (!reason.value.trim()) return ui.toast('Chọn hoặc nhập lý do huỷ', 'error')
  const approver = await ui.approve({ perm: 'invoices.cancel', reason: `Huỷ ${inv.value.code} · ${reason.value}` })
  if (!approver) return
  invoices.cancel(inv.value.id, reason.value.trim(), approver)
  cancelling.value = false
  ui.toast('Đã huỷ hoá đơn, hàng đã cộng lại kho')
}
</script>

<template>
  <BaseModal v-if="inv" :title="`Hoá đơn ${inv.code}`" width="440px" @close="emit('close')">
    <template #header-extra>
      <span class="badge" :class="inv.status === 'completed' ? 'badge--success' : 'badge--danger'">
        {{ inv.status === 'completed' ? 'Hoàn thành' : 'Đã huỷ' }}
      </span>
    </template>
    <InvoicePrint :invoice="inv" />

    <div class="inv-meta">
      <div v-if="inv.createdByName"><span>Người bán</span><b>{{ inv.createdByName }}</b></div>
      <div v-if="shiftCode"><span>Ca</span><b>{{ shiftCode }}</b></div>
      <div v-if="inv.discountApprovedBy"><span>Giảm giá được duyệt bởi</span><b>{{ inv.discountApprovedBy }}</b></div>
      <div v-if="inv.note"><span>Ghi chú</span><b>{{ inv.note }}</b></div>
      <template v-if="inv.einvoice">
        <div><span>Hoá đơn điện tử</span><b><span class="badge badge--plain" :class="`badge--${EINV_STATUS[inv.einvoice.status][1]}`">{{ EINV_STATUS[inv.einvoice.status][0] }}</span></b></div>
        <div v-if="inv.einvoice.number"><span>Số HĐĐT</span><b class="num">{{ inv.einvoice.series }} · {{ inv.einvoice.number }}<template v-if="inv.einvoice.sandbox"> (thử nghiệm)</template></b></div>
        <div v-if="inv.einvoice.lookupCode"><span>Mã tra cứu</span><b class="num">{{ inv.einvoice.lookupCode }}</b></div>
        <div v-if="inv.einvoice.buyer?.taxCode"><span>Người mua</span><b>{{ inv.einvoice.buyer.companyName }} · MST {{ inv.einvoice.buyer.taxCode }}</b></div>
        <div v-if="inv.einvoice.status === 'failed'"><span>Lỗi</span><b class="text-danger">{{ inv.einvoice.error }}</b></div>
      </template>
      <div v-if="inv.status === 'cancelled' && inv.einvoice?.status === 'issued'" class="einv-warn">
        Hoá đơn này đã xuất HĐĐT. Huỷ trên app không tự huỷ HĐĐT — hãy lập hoá đơn điều chỉnh/thay thế trên hệ thống {{ PROVIDERS[inv.einvoice.provider] }}.
      </div>
      <template v-if="inv.status === 'cancelled'">
        <div><span>Huỷ lúc</span><b>{{ inv.cancelledAt ? fmtDateTime(inv.cancelledAt) : '—' }}</b></div>
        <div v-if="inv.cancelledByName"><span>Người huỷ</span><b>{{ inv.cancelledByName }}<template v-if="inv.cancelApprovedBy"> · {{ inv.cancelApprovedBy }} duyệt</template></b></div>
        <div v-if="inv.cancelReason"><span>Lý do</span><b>{{ inv.cancelReason }}</b></div>
      </template>
    </div>

    <div v-if="cancelling" class="cancel-box">
      <b>Lý do huỷ</b>
      <div class="flex" style="flex-wrap: wrap; margin: 8px 0">
        <button v-for="r in REASONS" :key="r" class="chip" :class="{ active: reason === r }" @click="reason = r">{{ r }}</button>
      </div>
      <input class="input" v-model="reason" placeholder="Hoặc nhập lý do khác…" />
    </div>

    <template #footer>
      <template v-if="cancelling">
        <button class="btn btn--ghost" @click="cancelling = false">Thôi</button>
        <div class="spacer"></div>
        <button class="btn btn--danger" @click="confirmCancel"><Icon name="trash" :size="15" />Xác nhận huỷ</button>
      </template>
      <template v-else>
        <button v-if="inv.status === 'completed'" class="btn btn--danger" @click="cancelling = true"><Icon name="trash" :size="15" />Huỷ</button>
        <div class="spacer"></div>
        <button v-if="einvOn && inv.status === 'completed' && inv.einvoice?.status !== 'issued'" class="btn btn--ghost" @click="einvOpen = true"><Icon name="fa-file-invoice" :size="15" />{{ inv.einvoice?.status === 'failed' ? 'Xuất lại HĐĐT' : 'Xuất HĐĐT' }}</button>
        <button class="btn btn--ghost" @click="emit('close')">Đóng</button>
        <button class="btn btn--primary" @click="print"><Icon name="print" :size="15" />In hoá đơn</button>
      </template>
    </template>
  </BaseModal>
  <EinvoiceModal v-if="einvOpen" :invoice-id="inv.id" @close="einvOpen = false" />
</template>

<style lang="scss">
@use '../../styles/tokens' as *;
.inv-meta {
  margin-top: 14px; display: flex; flex-direction: column; gap: 6px; font-size: 13px;
  div { display: flex; justify-content: space-between; gap: 12px; } span { color: $text-muted; } b { font-weight: 500; text-align: right; }
}
.cancel-box { margin-top: 14px; padding: 14px; border-radius: 14px; background: $danger-soft; }
.einv-warn { margin-top: 4px; padding: 10px 12px; border-radius: 10px; background: var(--warning-soft); color: var(--warning); font-size: 12px; line-height: 1.45; }
</style>
