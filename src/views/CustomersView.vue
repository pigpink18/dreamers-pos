<script setup>
import AppSelect from '../components/ui/AppSelect.vue'
import { ref, computed } from 'vue'
import Icon from '../components/ui/Icon.vue'
import BaseModal from '../components/ui/BaseModal.vue'
import CustomerFormModal from '../components/customers/CustomerFormModal.vue'
import InvoiceDetailModal from '../components/invoices/InvoiceDetailModal.vue'
import { useCustomers } from '../stores/customers'
import { useInvoices, INVOICE_TYPES } from '../stores/invoices'
import { useRooms, BOOKING_STATUS } from '../stores/rooms'
import { useUi } from '../stores/ui'
import { useAuth } from '../stores/auth'
import { money, fmtDate, fmtDateTime, normalize, toCsv, download } from '../utils/format'

const customers = useCustomers()
const invoices = useInvoices()
const rooms = useRooms()
const ui = useUi()
const auth = useAuth()

// Thống kê theo khách: tính 1 lần cho tất cả hoá đơn
const stats = computed(() => {
  const m = {}
  for (const i of invoices.completed) {
    if (!i.customerId) continue
    const s = (m[i.customerId] ||= { count: 0, spent: 0, last: null, stays: 0 })
    s.count++
    s.spent += i.total
    if (!s.last || i.createdAt > s.last) s.last = i.createdAt
    if (i.type === 'room') s.stays++
  }
  return m
})
const st = (id) => stats.value[id] || { count: 0, spent: 0, last: null, stays: 0 }

const q = ref('')
const sort = ref('spent')
const list = computed(() => {
  const k = normalize(q.value)
  return customers.items
    .filter((c) => !k || normalize(c.name).includes(k) || (c.phone || '').includes(k) || normalize(c.code).includes(k))
    .sort((a, b) => (sort.value === 'name' ? a.name.localeCompare(b.name, 'vi') : sort.value === 'recent' ? (st(b.id).last || '').localeCompare(st(a.id).last || '') : st(b.id).spent - st(a.id).spent))
})

const formFor = ref(undefined) // undefined = đóng, null = thêm mới, object = sửa
const detail = ref(null)
const openInvoice = ref(null)
const detailInvoices = computed(() => (detail.value ? invoices.ofCustomer(detail.value.id) : []))
const detailBookings = computed(() =>
  detail.value ? rooms.bookings.filter((b) => b.customerId === detail.value.id).sort((a, b) => b.checkIn.localeCompare(a.checkIn)) : []
)

async function remove(c) {
  if (!(await ui.confirm(`Xoá khách hàng "${c.name}"? Hoá đơn cũ vẫn giữ tên khách.`, { danger: true, okText: 'Xoá' }))) return
  customers.remove(c.id)
  detail.value = null
  ui.toast('Đã xoá khách hàng')
}

function exportCsv() {
  const rows = [['Mã', 'Tên', 'Điện thoại', 'Email', 'Địa chỉ', 'Số hoá đơn', 'Tổng chi tiêu', 'Lần cuối']]
  list.value.forEach((c) => rows.push([c.code, c.name, c.phone, c.email, c.address, st(c.id).count, st(c.id).spent, st(c.id).last ? fmtDate(st(c.id).last) : '']))
  download('khach-hang.csv', toCsv(rows))
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div><h1>Khách hàng</h1><p>{{ customers.items.length }} khách hàng</p></div>
      <div class="spacer"></div>
      <button class="btn btn--ghost" @click="exportCsv"><Icon name="download" :size="16" />Xuất CSV</button>
      <button v-if="auth.can('customers.manage')" class="btn btn--primary" @click="formFor = null"><Icon name="plus" :size="16" />Thêm khách hàng</button>
    </div>

    <div class="card">
      <div class="toolbar">
        <div class="search" style="flex: 1; min-width: 220px"><input class="input" v-model="q" placeholder="Tìm theo tên, SĐT, mã khách..." /></div>
        <AppSelect v-model="sort" :options="[{ value: 'spent', label: 'Chi tiêu nhiều nhất' }, { value: 'recent', label: 'Mua gần đây' }, { value: 'name', label: 'Tên A → Z' }]" style="width: 200px" />
      </div>
      <div class="table-wrap">
        <table class="table table--cards">
          <thead><tr><th>Khách hàng</th><th>Điện thoại</th><th>Địa chỉ</th><th class="text-right">Số HĐ</th><th class="text-right">Lưu trú</th><th class="text-right">Tổng chi tiêu</th><th>Lần cuối</th></tr></thead>
          <tbody>
            <tr v-for="c in list" :key="c.id" class="clickable" @click="detail = c">
              <td class="c-title">
                <div class="flex">
                  <div class="cpicker__avatar">{{ c.name.split(' ').pop()[0] }}</div>
                  <div><div class="fw-600">{{ c.name }}</div><div class="muted" style="font-size: 12px">{{ c.code }}</div></div>
                </div>
              </td>
              <td class="num c-hide">{{ c.phone || '—' }}</td>
              <td class="text-2 c-hide">{{ c.address || '—' }}</td>
              <td class="text-right num c-hide">{{ st(c.id).count }}</td>
              <td class="text-right num c-hide">{{ st(c.id).stays }}</td>
              <td class="text-right num fw-600 c-end">{{ money(st(c.id).spent) }}</td>
              <td class="text-2 num c-hide">{{ st(c.id).last ? fmtDate(st(c.id).last) : '—' }}</td>
              <td class="m-only c-sub">{{ c.phone || '—' }} · {{ st(c.id).count }} hoá đơn<span v-if="st(c.id).stays"> · {{ st(c.id).stays }} lần lưu trú</span></td>
            </tr>
            <tr v-if="!list.length"><td colspan="7" class="empty">Không tìm thấy khách hàng</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Chi tiết khách -->
    <BaseModal v-if="detail" :title="detail.name" width="760px" @close="detail = null">
      <template #header-extra><span class="muted">{{ detail.code }}</span></template>
      <div class="cust-head">
        <div><span class="muted">Điện thoại</span><b>{{ detail.phone || '—' }}</b></div>
        <div><span class="muted">Email</span><b>{{ detail.email || '—' }}</b></div>
        <div><span class="muted">Địa chỉ</span><b>{{ detail.address || '—' }}</b></div>
        <div><span class="muted">Tổng chi tiêu</span><b class="num" style="color: var(--primary)">{{ money(st(detail.id).spent) }}</b></div>
      </div>
      <p v-if="detail.note" class="text-2">📝 {{ detail.note }}</p>

      <h4 class="sec-title">Lịch sử mua hàng ({{ detailInvoices.length }})</h4>
      <div class="table-wrap scroll-box">
        <table class="table">
          <tbody>
            <tr v-for="i in detailInvoices" :key="i.id" class="clickable" @click="openInvoice = i.id">
              <td class="fw-600">{{ i.code }}</td>
              <td class="num text-2">{{ fmtDateTime(i.createdAt) }}</td>
              <td><span class="badge badge--plain" :class="i.type === 'room' ? 'badge--info' : ''">{{ INVOICE_TYPES[i.type] }}</span></td>
              <td class="text-right num fw-600" :class="{ muted: i.status === 'cancelled' }">{{ money(i.total) }}</td>
            </tr>
            <tr v-if="!detailInvoices.length"><td class="empty">Chưa có hoá đơn</td></tr>
          </tbody>
        </table>
      </div>

      <h4 class="sec-title">Lịch sử lưu trú ({{ detailBookings.length }})</h4>
      <div class="table-wrap scroll-box">
        <table class="table">
          <tbody>
            <tr v-for="b in detailBookings" :key="b.id">
              <td class="fw-600">{{ b.code }}</td>
              <td>Phòng {{ rooms.roomById(b.roomId)?.name }}</td>
              <td class="num text-2">{{ fmtDate(b.checkIn) }} → {{ fmtDate(b.checkOut) }}</td>
              <td><span class="badge" :class="`badge--${BOOKING_STATUS[b.status].badge}`">{{ BOOKING_STATUS[b.status].label }}</span></td>
            </tr>
            <tr v-if="!detailBookings.length"><td class="empty">Chưa lưu trú lần nào</td></tr>
          </tbody>
        </table>
      </div>
      <template #footer>
        <button v-if="auth.can('customers.manage')" class="btn btn--danger" @click="remove(detail)"><Icon name="trash" :size="16" />Xoá</button>
        <div class="spacer"></div>
        <button v-if="auth.can('customers.manage')" class="btn btn--primary" @click="formFor = detail"><Icon name="edit" :size="16" />Sửa thông tin</button>
      </template>
    </BaseModal>

    <CustomerFormModal v-if="formFor !== undefined" :customer="formFor" @close="formFor = undefined" @saved="(id) => detail && (detail = customers.byId(id))" />
    <InvoiceDetailModal v-if="openInvoice" :invoice-id="openInvoice" @close="openInvoice = null" />
  </div>
</template>

<style lang="scss">
.cust-head {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; padding: 14px; background: var(--surface-2); border-radius: 12px; border: 1px solid var(--border);
  div { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  span { font-size: 12px; }
  b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
}
.sec-title { margin: 20px 0 8px; font-size: 14px; }
.scroll-box { max-height: 220px; overflow-y: auto; border: 1px solid var(--border); border-radius: 10px; }
.cpicker__avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--primary); color: var(--on-primary); display: grid; place-items: center; font-weight: 600; flex-shrink: 0; }
@media (max-width: 700px) { .cust-head { grid-template-columns: 1fr 1fr; } }
</style>
