<script setup>
import AppSelect from '../components/ui/AppSelect.vue'
import { ref, reactive, computed } from 'vue'
import Icon from '../components/ui/Icon.vue'
import BaseModal from '../components/ui/BaseModal.vue'
import ProductFormModal from '../components/products/ProductFormModal.vue'
import StatCard from '../components/ui/StatCard.vue'
import { useProducts } from '../stores/products'
import { useUi } from '../stores/ui'
import { useAuth } from '../stores/auth'
import { money, number, fmtDateTime, normalize } from '../utils/format'

const products = useProducts()
const ui = useUi()
const auth = useAuth()
// Giá vốn & lãi là thông tin nhạy cảm: chỉ người được sửa hàng hoá mới thấy
const seeCost = computed(() => auth.can('products.manage'))
const tab = ref('items')

// ---------- Danh sách ----------
const q = ref('')
const cat = ref('')
const onlyLow = ref(false)
const list = computed(() => {
  const k = normalize(q.value)
  const low = new Set(products.lowStock.map((p) => p.id))
  return products.active.filter(
    (p) => (!cat.value || p.category === cat.value) && (!onlyLow.value || low.has(p.id)) &&
      (!k || normalize(p.name).includes(k) || normalize(p.code).includes(k))
  )
})

// ---------- Form hàng hoá ----------
const editing = ref(null) // { product } khi đang mở form
const openForm = (p) => (editing.value = { product: p || null })
async function removeProduct(p) {
  if (await ui.confirm(`Ngừng kinh doanh "${p.name}"? Lịch sử hoá đơn vẫn được giữ.`, { danger: true, okText: 'Ngừng bán' })) {
    products.remove(p.id)
    ui.toast('Đã ngừng kinh doanh mặt hàng')
  }
}

// ---------- Nhập hàng ----------
const importing = ref(null)
function openImport(p) {
  importing.value = reactive({ supplier: '', note: '', lines: [p ? { productId: p.id, qty: 10, cost: p.cost } : { productId: '', qty: 1, cost: 0 }] })
}
const stockable = computed(() => products.active.filter((p) => p.trackStock !== false))
const importTotal = computed(() => importing.value?.lines.reduce((s, l) => s + (+l.qty || 0) * (+l.cost || 0), 0) || 0)
function onPickProduct(line) {
  line.cost = products.byId(line.productId)?.cost || 0
}
function saveImport() {
  const lines = importing.value.lines.filter((l) => l.productId && +l.qty > 0)
  if (!lines.length) return ui.toast('Chọn ít nhất 1 mặt hàng', 'error')
  const rec = products.createImport({ ...importing.value, lines })
  ui.toast(`Đã nhập kho ${rec.code}`)
  importing.value = null
  tab.value = 'imports'
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div><h1>Hàng hoá & kho</h1><p>Quản lý danh mục, giá bán và tồn kho</p></div>
      <div class="spacer"></div>
      <button v-if="auth.can('products.import')" class="btn btn--ghost" @click="openImport()"><Icon name="upload" :size="16" />Nhập hàng</button>
      <button v-if="auth.can('products.manage')" class="btn btn--primary" @click="openForm()"><Icon name="plus" :size="16" />Thêm hàng hoá</button>
    </div>

    <div class="grid-stats">
      <StatCard label="Mặt hàng đang bán" :value="number(products.active.length)" icon="box" />
      <StatCard v-if="seeCost" label="Giá trị tồn kho (giá vốn)" :value="money(products.stockValue)" icon="money" tone="info" />
      <StatCard label="Sắp hết hàng" :value="number(products.lowStock.length)" icon="alert" tone="warning" hint="≤ mức tồn tối thiểu" />
    </div>

    <div class="card">
      <div class="toolbar">
        <div class="segmented">
          <button :class="{ active: tab === 'items' }" @click="tab = 'items'">Hàng hoá</button>
          <button :class="{ active: tab === 'imports' }" @click="tab = 'imports'">Lịch sử nhập ({{ products.imports.length }})</button>
        </div>
        <template v-if="tab === 'items'">
          <div class="search" style="flex: 1; min-width: 200px"><input class="input" v-model="q" placeholder="Tìm theo tên, mã hàng..." /></div>
          <AppSelect v-model="cat" :options="[{ value: '', label: 'Tất cả nhóm' }, ...products.categories]" style="width: 170px" />
          <label class="flex" style="cursor: pointer"><input type="checkbox" v-model="onlyLow" /> Sắp hết hàng</label>
        </template>
      </div>

      <div class="table-wrap" v-if="tab === 'items'">
        <table class="table table--cards">
          <thead>
            <tr><th>Hàng hoá</th><th>Nhóm</th><th class="text-right">Giá bán</th><template v-if="seeCost"><th class="text-right">Giá vốn</th><th class="text-right">Lãi/đv</th></template><th class="text-right">Tồn kho</th><th></th></tr>
          </thead>
          <tbody>
            <tr v-for="p in list" :key="p.id">
              <td class="c-title">
                <div class="flex">
                  <span class="swatch" :style="{ background: p.color }"></span>
                  <div><div class="fw-600">{{ p.name }}</div><div class="muted" style="font-size: 12px">{{ p.code }} · {{ p.unit }}</div></div>
                </div>
              </td>
              <td class="text-2 c-hide">{{ p.category }}</td>
              <td class="text-right num fw-600 c-end">{{ number(p.price) }}</td>
              <td v-if="seeCost" class="text-right num text-2 c-hide">{{ number(p.cost) }}</td>
              <td v-if="seeCost" class="text-right num text-success c-hide">{{ number(p.price - p.cost) }}</td>
              <td class="text-right num c-l2">
                <span v-if="p.trackStock === false" class="muted">Không quản lý</span>
                <span v-else class="badge badge--plain" :class="p.stock <= (p.minStock ?? 5) ? 'badge--warning' : ''">{{ number(p.stock) }} {{ p.unit }}</span>
              </td>
              <td class="text-right c-r2" style="white-space: nowrap">
                <button v-if="p.trackStock !== false && auth.can('products.import')" class="btn btn--ghost btn--sm" @click="openImport(p)">Nhập</button>
                <button v-if="auth.can('products.manage')" class="btn btn--ghost btn--sm btn--icon" @click="openForm(p)" aria-label="Sửa"><Icon name="edit" :size="15" /></button>
                <button v-if="auth.can('products.manage')" class="btn btn--ghost btn--sm btn--icon" @click="removeProduct(p)" aria-label="Ngừng bán"><Icon name="trash" :size="15" /></button>
              </td>
            </tr>
            <tr v-if="!list.length"><td colspan="7" class="empty">Không có hàng hoá phù hợp</td></tr>
          </tbody>
        </table>
      </div>

      <div class="table-wrap" v-else>
        <table class="table">
          <thead><tr><th>Mã phiếu</th><th>Thời gian</th><th>Nhà cung cấp</th><th>Mặt hàng</th><th class="text-right">Tổng tiền</th></tr></thead>
          <tbody>
            <tr v-for="r in products.imports" :key="r.id">
              <td class="fw-600">{{ r.code }}</td>
              <td class="num">{{ fmtDateTime(r.date) }}</td>
              <td>{{ r.supplier || '—' }}</td>
              <td class="text-2">{{ r.items.map((l) => `${l.name} ×${l.qty}`).join(', ') }}</td>
              <td class="text-right num fw-600">{{ money(r.total) }}</td>
            </tr>
            <tr v-if="!products.imports.length"><td colspan="5" class="empty">Chưa có phiếu nhập nào</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Form hàng hoá -->
    <ProductFormModal v-if="editing" :product="editing.product" @close="editing = null" />

    <!-- Phiếu nhập hàng -->
    <BaseModal v-if="importing" title="Phiếu nhập hàng" width="720px" @close="importing = null">
      <div class="form-grid" style="margin-bottom: 16px">
        <div class="field"><label>Nhà cung cấp</label><input class="input" v-model="importing.supplier" placeholder="VD: Đại lý Phúc Long" /></div>
        <div class="field"><label>Ghi chú</label><input class="input" v-model="importing.note" /></div>
      </div>
      <table class="table import-table">
        <thead><tr><th>Mặt hàng</th><th style="width: 100px">Số lượng</th><th style="width: 140px">Giá nhập</th><th class="text-right" style="width: 120px">Thành tiền</th><th style="width: 40px"></th></tr></thead>
        <tbody>
          <tr v-for="(l, i) in importing.lines" :key="i">
            <td>
              <AppSelect
                v-model="l.productId" @change="onPickProduct(l)" placeholder="Chọn hàng…" :searchable="true"
                :options="stockable.map((p) => ({ value: p.id, label: p.name, sub: 'tồn ' + p.stock }))"
              />
            </td>
            <td><input class="input num" type="number" min="1" v-model="l.qty" /></td>
            <td><input class="input num" type="number" min="0" step="1000" v-model="l.cost" /></td>
            <td class="text-right num fw-600">{{ number((+l.qty || 0) * (+l.cost || 0)) }}</td>
            <td><button class="btn btn--ghost btn--icon btn--sm" @click="importing.lines.splice(i, 1)" aria-label="Xoá dòng"><Icon name="x" :size="14" /></button></td>
          </tr>
        </tbody>
      </table>
      <div class="flex mt-16">
        <button class="btn btn--soft btn--sm" @click="importing.lines.push({ productId: '', qty: 1, cost: 0 })"><Icon name="plus" :size="14" />Thêm dòng</button>
        <div class="spacer"></div>
        <span class="text-2">Tổng tiền nhập:</span><b class="num" style="font-size: 18px">{{ money(importTotal) }}</b>
      </div>
      <template #footer>
        <button class="btn btn--ghost" @click="importing = null">Huỷ</button>
        <button class="btn btn--primary" @click="saveImport"><Icon name="check" :size="16" />Hoàn tất nhập kho</button>
      </template>
    </BaseModal>
  </div>
</template>

<style lang="scss">
.import-table td { padding: 6px 8px; }
</style>
