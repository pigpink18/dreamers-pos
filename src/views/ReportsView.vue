<script setup>
/**
 * BÁO CÁO — tổng hợp hoá đơn theo Ngày / Tháng / Quý / Năm
 * Mọi con số được tính từ danh sách hoá đơn (utils/report.js)
 */
import { ref, computed } from 'vue'
import Icon from '../components/ui/Icon.vue'
import AppDate from '../components/ui/AppDate.vue'
import AppSelect from '../components/ui/AppSelect.vue'
import StatCard from '../components/ui/StatCard.vue'
import BarChart from '../components/ui/BarChart.vue'
import InvoiceDetailModal from '../components/invoices/InvoiceDetailModal.vue'
import { useInvoices, PAY_METHODS, INVOICE_TYPES } from '../stores/invoices'
import { MODES, defaultRef, shiftRef, buildRange, aggregate, comparableRange } from '../utils/report'
import { money, number, pct, fmtTime, fmtDateTime, toCsv, download } from '../utils/format'

const invoices = useInvoices()

const mode = ref('month')
const refs = ref({ day: defaultRef('day'), month: defaultRef('month'), quarter: defaultRef('quarter'), year: defaultRef('year') })
const current = computed({ get: () => refs.value[mode.value], set: (v) => (refs.value[mode.value] = v) })

const range = computed(() => buildRange(mode.value, current.value))
const prevRange = computed(() => comparableRange(mode.value, current.value))
const cmpHint = computed(() => (prevRange.value.partial ? 'so với cùng kỳ trước' : 'so với kỳ trước'))
const r = computed(() => aggregate(invoices.items, range.value))
const p = computed(() => aggregate(invoices.items, prevRange.value))

const SERIES = [
  { key: 'retail', label: 'Bán hàng', color: 'var(--chart-1)' },
  { key: 'room', label: 'Tiền phòng', color: 'var(--chart-2)' },
]

// Bộ chọn quý
const years = computed(() => {
  const y = new Date().getFullYear()
  return [y - 2, y - 1, y, y + 1]
})
const qYear = computed({
  get: () => +current.value.slice(0, 4),
  set: (y) => (current.value = mode.value === 'quarter' ? `${y}-Q${current.value.slice(-1)}` : String(y)),
})
const qNum = computed({ get: () => +current.value.slice(-1), set: (q) => (current.value = `${qYear.value}-Q${q}`) })

// Tổng hợp theo tháng (dùng cho Quý & Năm)
const months = computed(() => {
  if (!['quarter', 'year'].includes(mode.value)) return []
  const s = range.value.start
  const n = mode.value === 'quarter' ? 3 : 12
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(s.getFullYear(), s.getMonth() + i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    return { label: `Tháng ${d.getMonth() + 1}/${d.getFullYear()}`, ...aggregate(r.value.list, buildRange('month', key)) }
  })
})

const methodRows = computed(() =>
  Object.entries(PAY_METHODS).map(([k, label]) => ({ label, value: r.value.methods[k] || 0, share: r.value.revenue ? ((r.value.methods[k] || 0) / r.value.revenue) * 100 : 0 }))
)
const margin = computed(() => (r.value.revenue ? (r.value.profit / r.value.revenue) * 100 : 0))
const showAllProducts = ref(false)
const tableBuckets = computed(() => r.value.buckets.filter((b) => mode.value !== 'day' || b.count))
const openId = ref(null)

function exportCsv() {
  const rows = [[`BÁO CÁO DOANH THU – ${range.value.label}`], []]
  rows.push(['Chỉ tiêu', 'Giá trị'])
  rows.push(['Tổng doanh thu', r.value.revenue], ['Doanh thu bán hàng', r.value.retail], ['Doanh thu tiền phòng', r.value.room])
  rows.push(['Số hoá đơn', r.value.count], ['Giá trị TB / hoá đơn', Math.round(r.value.avg)], ['Giảm giá', r.value.discount])
  rows.push(['Giá vốn', r.value.cost], ['Lợi nhuận gộp', r.value.profit], [])
  rows.push(['Thời gian', 'Số HĐ', 'Bán hàng', 'Tiền phòng', 'Tổng'])
  r.value.buckets.forEach((b) => rows.push([b.full, b.count, b.retail, b.room, b.total]))
  rows.push([], ['Hàng hoá', 'Số lượng', 'Doanh thu', 'Lợi nhuận'])
  r.value.topProducts.forEach((x) => rows.push([x.name, x.qty, x.revenue, x.profit]))
  download(`bao-cao_${current.value}.csv`, toCsv(rows))
}
</script>

<template>
  <div class="page report">
    <div class="page-header">
      <div><h1>Báo cáo doanh thu</h1><p>Tổng hợp hoá đơn theo ngày, tháng, quý</p></div>
      <div class="spacer"></div>
      <button class="btn btn--ghost" @click="exportCsv"><Icon name="download" :size="16" />Xuất CSV</button>
    </div>

    <!-- Chọn kỳ báo cáo -->
    <div class="card period">
      <div class="segmented">
        <button v-for="(l, k) in MODES" :key="k" :class="{ active: mode === k }" @click="mode = k">{{ l }}</button>
      </div>
      <div class="period__nav">
        <button class="btn btn--ghost btn--icon" @click="current = shiftRef(mode, current, -1)" aria-label="Kỳ trước"><Icon name="left" :size="16" /></button>
        <AppDate v-if="mode === 'day'" v-model="current" style="width: 160px" />
        <AppDate v-else-if="mode === 'month'" v-model="current" mode="month" style="width: 170px" />
        <template v-else>
          <AppSelect v-if="mode === 'quarter'" v-model="qNum" :options="[1, 2, 3, 4].map((q) => ({ value: q, label: 'Quý ' + q }))" style="width: 110px" />
          <AppSelect v-model="qYear" :options="years.map((y) => ({ value: y, label: String(y) }))" style="width: 100px" />
        </template>
        <button class="btn btn--ghost btn--icon" @click="current = shiftRef(mode, current, 1)" aria-label="Kỳ sau"><Icon name="right" :size="16" /></button>
        <button class="btn btn--soft btn--sm" @click="current = defaultRef(mode)">{{ { day: 'Hôm nay', month: 'Tháng này', quarter: 'Quý này', year: 'Năm nay' }[mode] }}</button>
      </div>
      <div class="period__label">{{ range.label }}</div>
    </div>

    <!-- Chỉ số chính -->
    <div class="grid-stats">
      <StatCard label="Tổng doanh thu" :value="money(r.revenue)" icon="money" :change="pct(r.revenue, p.revenue)" :hint="cmpHint" />
      <StatCard label="Số hoá đơn" :value="number(r.count)" icon="receipt" tone="info" :change="pct(r.count, p.count)" :hint="`${r.retailCount} bán · ${r.roomCount} phòng`" />
      <StatCard label="Giá trị TB / hoá đơn" :value="money(r.avg)" icon="trend" tone="success" :change="pct(r.avg, p.avg)" />
      <StatCard label="Lợi nhuận gộp" :value="money(r.profit)" icon="chart" tone="warning" :hint="`Biên ${margin.toFixed(1)}%`" />
    </div>

    <div class="report-grid">
      <!-- Biểu đồ -->
      <div class="card">
        <div class="card__header">
          <h3>Doanh thu theo {{ { day: 'giờ', month: 'ngày', quarter: 'tuần', year: 'tháng' }[mode] }}</h3>
          <div class="spacer"></div>
          <span class="muted">Bán hàng <b class="num" style="color: var(--text)">{{ money(r.retail) }}</b> · Phòng <b class="num" style="color: var(--text)">{{ money(r.room) }}</b></span>
        </div>
        <div class="card__body">
          <BarChart v-if="r.count" :data="r.buckets" :series="SERIES" :height="280" />
          <div v-else class="empty">Không có hoá đơn trong {{ range.label.toLowerCase() }}</div>
        </div>
      </div>

      <!-- Hình thức thanh toán -->
      <div class="card">
        <div class="card__header"><h3>Hình thức thanh toán</h3></div>
        <div class="card__body">
          <div v-for="m in methodRows" :key="m.label" class="meter">
            <div class="meter__top"><span>{{ m.label }}</span><b class="num">{{ money(m.value) }}</b></div>
            <div class="meter__track"><div class="meter__fill" :style="{ width: m.share + '%' }"></div></div>
            <div class="muted num" style="font-size: 12px">{{ m.share.toFixed(1) }}%</div>
          </div>
          <div class="kv mt-16">
            <div><span class="muted">Giảm giá đã cho</span><b class="num">{{ money(r.discount) }}</b></div>
            <div><span class="muted">Giá vốn hàng bán</span><b class="num">{{ money(r.cost) }}</b></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Tổng hợp theo tháng (Quý / Năm) -->
    <div v-if="months.length" class="card mt-16">
      <div class="card__header"><h3>Tổng hợp theo tháng</h3></div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Tháng</th><th class="text-right">Số HĐ</th><th class="text-right">Bán hàng</th><th class="text-right">Tiền phòng</th><th class="text-right">Tổng doanh thu</th><th class="text-right">Lợi nhuận gộp</th></tr></thead>
          <tbody>
            <tr v-for="m in months" :key="m.label">
              <td class="fw-600">{{ m.label }}</td>
              <td class="text-right num">{{ number(m.count) }}</td>
              <td class="text-right num">{{ money(m.retail) }}</td>
              <td class="text-right num">{{ money(m.room) }}</td>
              <td class="text-right num fw-600">{{ money(m.revenue) }}</td>
              <td class="text-right num text-success">{{ money(m.profit) }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr><td>Cả {{ mode === 'quarter' ? 'quý' : 'năm' }}</td><td class="text-right num">{{ number(r.count) }}</td><td class="text-right num">{{ money(r.retail) }}</td><td class="text-right num">{{ money(r.room) }}</td><td class="text-right num">{{ money(r.revenue) }}</td><td class="text-right num">{{ money(r.profit) }}</td></tr>
          </tfoot>
        </table>
      </div>
    </div>

    <div class="report-grid report-grid--even mt-16">
      <!-- Bảng chi tiết theo cột biểu đồ -->
      <div class="card">
        <div class="card__header"><h3>Chi tiết theo {{ { day: 'giờ', month: 'ngày', quarter: 'tuần', year: 'tháng' }[mode] }}</h3></div>
        <div class="table-wrap scroll-y">
          <table class="table">
            <thead><tr><th>Thời gian</th><th class="text-right">Số HĐ</th><th class="text-right">Bán hàng</th><th class="text-right">Phòng</th><th class="text-right">Tổng</th></tr></thead>
            <tbody>
              <tr v-for="b in tableBuckets" :key="b.key" :class="{ muted: !b.count }">
                <td style="white-space: nowrap">{{ b.full }}</td>
                <td class="text-right num">{{ b.count }}</td>
                <td class="text-right num">{{ number(b.retail) }}</td>
                <td class="text-right num">{{ number(b.room) }}</td>
                <td class="text-right num fw-600">{{ number(b.total) }}</td>
              </tr>
              <tr v-if="!tableBuckets.length"><td colspan="5" class="empty">Không có dữ liệu</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Top hàng hoá -->
      <div class="card">
        <div class="card__header">
          <h3>Hàng hoá bán chạy</h3><div class="spacer"></div>
          <button v-if="r.topProducts.length > 8" class="btn btn--ghost btn--sm" @click="showAllProducts = !showAllProducts">{{ showAllProducts ? 'Thu gọn' : 'Xem tất cả' }}</button>
        </div>
        <div class="table-wrap scroll-y">
          <table class="table">
            <thead><tr><th>#</th><th>Hàng hoá</th><th class="text-right">SL</th><th class="text-right">Doanh thu</th><th class="text-right">Lợi nhuận</th></tr></thead>
            <tbody>
              <tr v-for="(x, i) in showAllProducts ? r.topProducts : r.topProducts.slice(0, 8)" :key="x.name">
                <td class="muted">{{ i + 1 }}</td>
                <td class="fw-600">{{ x.name }}</td>
                <td class="text-right num">{{ number(x.qty) }}</td>
                <td class="text-right num">{{ number(x.revenue) }}</td>
                <td class="text-right num text-success">{{ number(x.profit) }}</td>
              </tr>
              <tr v-if="!r.topProducts.length"><td colspan="5" class="empty">Chưa bán hàng hoá nào</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Danh sách hoá đơn trong ngày -->
    <div v-if="mode === 'day'" class="card mt-16">
      <div class="card__header"><h3>Hoá đơn trong ngày ({{ r.count }})</h3></div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Giờ</th><th>Mã</th><th>Khách</th><th>Loại</th><th>Hình thức</th><th class="text-right">Tổng</th></tr></thead>
          <tbody>
            <tr v-for="i in r.list" :key="i.id" class="clickable" @click="openId = i.id">
              <td class="num">{{ fmtTime(i.createdAt) }}</td>
              <td class="fw-600" style="color: var(--primary)">{{ i.code }}</td>
              <td>{{ i.customerName }}</td>
              <td>{{ INVOICE_TYPES[i.type] }}</td>
              <td class="text-2">{{ PAY_METHODS[i.method] }}</td>
              <td class="text-right num fw-600">{{ money(i.total) }}</td>
            </tr>
            <tr v-if="!r.count"><td colspan="6" class="empty">Không có hoá đơn</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <InvoiceDetailModal v-if="openId" :invoice-id="openId" @close="openId = null" />
  </div>
</template>

<style lang="scss">
@use '../styles/tokens' as *;
.period {
  display: flex; align-items: center; gap: 16px; flex-wrap: wrap; padding: 14px 16px; margin-bottom: 20px;
  &__nav { display: flex; align-items: center; gap: 8px; }
  @media (max-width: 760px) { .segmented { width: 100%; button { flex: 1; } } &__nav { width: 100%; > .app-date, > .app-select { flex: 1; width: auto !important; min-width: 0; } } &__label { display: none; } }
  &__label { margin-left: auto; font-size: 18px; font-weight: 700; }
}
.report-grid { display: grid; grid-template-columns: 1fr 320px; gap: 16px; align-items: start; &--even { grid-template-columns: 1fr 1fr; } }
.meter {
  margin-bottom: 14px;
  &__top { display: flex; justify-content: space-between; margin-bottom: 6px; }
  &__track { height: 8px; background: $fill; border-radius: 4px; overflow: hidden; }
  &__fill { height: 100%; background: var(--chart-1); border-radius: 4px; transition: width .3s; }
}
.kv { display: flex; flex-direction: column; gap: 8px; padding-top: 14px; border-top: 1px solid $border; div { display: flex; justify-content: space-between; } }
.scroll-y { max-height: 420px; overflow-y: auto; thead th { position: sticky; top: 0; z-index: 1; } }
@media (max-width: 1100px) { .report-grid, .report-grid--even { grid-template-columns: 1fr; } }
</style>
