<script setup>
import { ref, computed, watch } from 'vue'
import Icon from '../components/ui/Icon.vue'
import AppDate from '../components/ui/AppDate.vue'
import AppSelect from '../components/ui/AppSelect.vue'
import InvoiceDetailModal from '../components/invoices/InvoiceDetailModal.vue'
import { useInvoices, PAY_METHODS, INVOICE_TYPES } from '../stores/invoices'
import { money, fmtDateTime, dateKey, addDays, normalize, toCsv, download } from '../utils/format'

const invoices = useInvoices()
const today = dateKey()

// ---------- Bộ lọc ----------
const from = ref(addDays(today, -6))
const to = ref(today)
const q = ref('')
const type = ref('')
const status = ref('completed')
const method = ref('')

const PRESETS = {
  today: ['Hôm nay', () => [today, today]],
  yesterday: ['Hôm qua', () => [addDays(today, -1), addDays(today, -1)]],
  week: ['7 ngày', () => [addDays(today, -6), today]],
  month: ['Tháng này', () => [today.slice(0, 8) + '01', today]],
}
const preset = ref('week')
function applyPreset(k) {
  preset.value = k
  ;[from.value, to.value] = PRESETS[k][1]()
}

const filtered = computed(() => {
  const k = normalize(q.value)
  return invoices.items.filter((i) => {
    const d = dateKey(i.createdAt)
    return (
      d >= from.value && d <= to.value &&
      (!type.value || i.type === type.value) &&
      (!status.value || i.status === status.value) &&
      (!method.value || i.method === method.value) &&
      (!k || normalize(i.code).includes(k) || normalize(i.customerName).includes(k))
    )
  })
})
const totals = computed(() =>
  filtered.value.reduce(
    (s, i) => {
      if (i.status === 'completed') { s.total += i.total; s.discount += i.discount; s.subtotal += i.subtotal }
      return s
    },
    { total: 0, discount: 0, subtotal: 0 }
  )
)

// ---------- Phân trang ----------
const PAGE = 20
const page = ref(1)
const pages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE)))
const paged = computed(() => filtered.value.slice((page.value - 1) * PAGE, page.value * PAGE))
watch([from, to, q, type, status, method], () => (page.value = 1))

const openId = ref(null)

function exportCsv() {
  const rows = [['Mã', 'Thời gian', 'Loại', 'Khách hàng', 'Tổng tiền hàng', 'Giảm giá', 'Thanh toán', 'Hình thức', 'Trạng thái']]
  filtered.value.forEach((i) =>
    rows.push([i.code, fmtDateTime(i.createdAt), INVOICE_TYPES[i.type], i.customerName, i.subtotal, i.discount, i.total, PAY_METHODS[i.method], i.status === 'completed' ? 'Hoàn thành' : 'Đã huỷ'])
  )
  download(`hoa-don_${from.value}_${to.value}.csv`, toCsv(rows))
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1>Hoá đơn</h1>
        <p>{{ filtered.length }} hoá đơn · Doanh thu <b class="num" style="color: var(--text)">{{ money(totals.total) }}</b></p>
      </div>
      <div class="spacer"></div>
      <button class="btn btn--ghost" @click="exportCsv"><Icon name="download" :size="16" />Xuất Excel (CSV)</button>
      <RouterLink to="/pos" class="btn btn--primary"><Icon name="plus" :size="16" />Tạo hoá đơn</RouterLink>
    </div>

    <div class="card">
      <div class="toolbar">
        <div class="segmented">
          <button v-for="(p, k) in PRESETS" :key="k" :class="{ active: preset === k }" @click="applyPreset(k)">{{ p[0] }}</button>
        </div>
        <div class="flex date-range">
          <AppDate v-model="from" @update:model-value="preset = ''" />
          <span class="muted">→</span>
          <AppDate v-model="to" :min="from" @update:model-value="preset = ''" />
        </div>
        <div class="search" style="flex: 1; min-width: 200px"><input class="input" v-model="q" placeholder="Mã hoá đơn, tên khách..." /></div>
        <AppSelect v-model="type" :options="[{ value: '', label: 'Mọi loại' }, ...Object.entries(INVOICE_TYPES).map(([value, label]) => ({ value, label }))]" style="width: 150px" />
        <AppSelect v-model="method" :options="[{ value: '', label: 'Mọi hình thức' }, ...Object.entries(PAY_METHODS).map(([value, label]) => ({ value, label }))]" style="width: 160px" />
        <AppSelect v-model="status" :options="[{ value: '', label: 'Mọi trạng thái' }, { value: 'completed', label: 'Hoàn thành' }, { value: 'cancelled', label: 'Đã huỷ' }]" style="width: 160px" />
      </div>

      <div class="table-wrap">
        <table class="table table--cards">
          <thead>
            <tr>
              <th>Mã hoá đơn</th><th>Thời gian</th><th>Khách hàng</th><th>Loại</th><th>Hình thức</th>
              <th class="text-right">Tổng tiền hàng</th><th class="text-right">Giảm giá</th><th class="text-right">Khách trả</th><th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="i in paged" :key="i.id" class="clickable" @click="openId = i.id">
              <td class="fw-600 c-title" style="color: var(--primary)">{{ i.code }}</td>
              <td class="num c-hide">{{ fmtDateTime(i.createdAt) }}</td>
              <td class="c-hide">{{ i.customerName }}</td>
              <td class="c-hide"><span class="badge badge--plain" :class="i.type === 'room' ? 'badge--info' : ''">{{ INVOICE_TYPES[i.type] }}</span></td>
              <td class="text-2 c-hide">{{ PAY_METHODS[i.method] }}</td>
              <td class="text-right num c-hide">{{ money(i.subtotal) }}</td>
              <td class="text-right num text-2 c-hide">{{ i.discount ? money(i.discount) : '—' }}</td>
              <td class="text-right num fw-600 c-end" :class="{ muted: i.status === 'cancelled' }">{{ money(i.total) }}</td>
              <td class="c-hide"><span class="badge" :class="i.status === 'completed' ? 'badge--success' : 'badge--danger'">{{ i.status === 'completed' ? 'Hoàn thành' : 'Đã huỷ' }}</span></td>
              <td class="m-only c-sub">
                {{ i.customerName }} · {{ fmtDateTime(i.createdAt) }} · {{ PAY_METHODS[i.method] }}
                <span v-if="i.status === 'cancelled'" class="badge badge--danger">Đã huỷ</span>
              </td>
            </tr>
            <tr v-if="!paged.length"><td colspan="9" class="empty">Không có hoá đơn nào trong khoảng này</td></tr>
          </tbody>
          <tfoot v-if="filtered.length">
            <tr>
              <td colspan="5">Tổng ({{ filtered.length }} hoá đơn, không tính đơn huỷ)</td>
              <td class="text-right num">{{ money(totals.subtotal) }}</td>
              <td class="text-right num">{{ money(totals.discount) }}</td>
              <td class="text-right num">{{ money(totals.total) }}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div class="pager" v-if="pages > 1">
        <span class="muted">Trang {{ page }} / {{ pages }}</span>
        <button class="btn btn--ghost btn--sm btn--icon" :disabled="page === 1" @click="page--" aria-label="Trang trước"><Icon name="left" :size="16" /></button>
        <button class="btn btn--ghost btn--sm btn--icon" :disabled="page === pages" @click="page++" aria-label="Trang sau"><Icon name="right" :size="16" /></button>
      </div>
    </div>

    <InvoiceDetailModal v-if="openId" :invoice-id="openId" @close="openId = null" />
  </div>
</template>

<style lang="scss">
.date-range { .app-date { width: 150px; } }
@media (max-width: 760px) { .date-range { flex: 1 1 100% !important; .app-date { flex: 1; width: auto; min-width: 0; } } }
.pager { display: flex; align-items: center; justify-content: flex-end; gap: 8px; padding: 12px 16px; border-top: 1px solid var(--border); }
</style>
