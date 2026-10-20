<script setup>
/**
 * Form thêm / sửa món (hàng hoá). Dùng chung cho trang Hàng hoá và màn hình Bán hàng (chế độ "Sửa menu").
 * props.product: món cần sửa (null = thêm mới) · props.category: nhóm gợi ý khi thêm mới
 */
import { reactive } from 'vue'
import BaseModal from '../ui/BaseModal.vue'
import Icon from '../ui/Icon.vue'
import { useProducts } from '../../stores/products'
import { useUi } from '../../stores/ui'

const props = defineProps({ product: { type: Object, default: null }, category: { type: String, default: '' }, trackStock: { type: Boolean, default: true } })
const emit = defineEmits(['close', 'saved'])
const products = useProducts()
const ui = useUi()

const PRODUCT_COLORS = ['#7b4a26', '#a35a25', '#c08552', '#3b2a20', '#5b6b4e', '#2f6d6a', '#2a5d9f', '#6b5b95', '#9b4a4a', '#64748b']

const f = reactive(
  props.product
    ? { ...props.product }
    : { name: '', desc: '', category: props.category || products.categories[0] || '', unit: props.trackStock ? 'Cái' : 'Ly', price: 0, cost: 0, stock: 0, minStock: 5, trackStock: props.trackStock, color: PRODUCT_COLORS[0] }
)

function save() {
  if (!f.name.trim()) return ui.toast('Nhập tên món', 'error')
  if (!f.category.trim()) return ui.toast('Nhập nhóm món', 'error')
  if (!(+f.price >= 0)) return ui.toast('Giá bán không hợp lệ', 'error')
  const id = products.save({ ...f, name: f.name.trim(), category: f.category.trim(), price: +f.price, cost: +f.cost || 0, stock: +f.stock || 0, minStock: +f.minStock || 0 })
  ui.toast(f.id ? `Đã cập nhật ${f.name}` : `Đã thêm ${f.name} vào menu`)
  emit('saved', id)
  emit('close')
}
async function remove() {
  if (!(await ui.confirm(`Bỏ "${f.name}" khỏi menu? Lịch sử hoá đơn vẫn được giữ.`, { danger: true, okText: 'Bỏ khỏi menu' }))) return
  products.remove(f.id)
  ui.toast(`Đã bỏ ${f.name} khỏi menu`)
  emit('close')
}
</script>

<template>
  <BaseModal :title="f.id ? 'Sửa món' : 'Thêm món'" @close="emit('close')">
    <form id="pform" class="form-grid" @submit.prevent="save">
      <div class="field full"><label>Tên món *</label><input class="input" v-model="f.name" autofocus placeholder="VD: Bạc xỉu đá" /></div>
      <div class="field full"><label>Mô tả ngắn</label><input class="input" v-model="f.desc" placeholder="VD: Ginger with cinnamon and arabica coffee" /></div>
      <div class="field">
        <label>Nhóm *</label>
        <input class="input" v-model="f.category" list="pform-cats" placeholder="Chọn hoặc gõ nhóm mới" />
        <datalist id="pform-cats"><option v-for="c in products.categories" :key="c" :value="c" /></datalist>
      </div>
      <div class="field"><label>Đơn vị tính</label><input class="input" v-model="f.unit" /></div>
      <div class="field"><label>Giá bán *</label><input class="input num" type="number" min="0" step="1000" v-model="f.price" /></div>
      <div class="field"><label>Giá vốn</label><input class="input num" type="number" min="0" step="1000" v-model="f.cost" /></div>
      <label class="flex full" style="cursor: pointer"><input type="checkbox" v-model="f.trackStock" /> Quản lý tồn kho (đồ đóng chai, bánh… — đồ pha chế thì bỏ chọn)</label>
      <template v-if="f.trackStock">
        <div class="field"><label>{{ f.id ? 'Tồn kho hiện tại' : 'Tồn kho ban đầu' }}</label><input class="input num" type="number" v-model="f.stock" /></div>
        <div class="field"><label>Cảnh báo khi tồn ≤</label><input class="input num" type="number" min="0" v-model="f.minStock" /></div>
      </template>
      <div class="field full">
        <label>Màu thẻ trên màn hình bán hàng</label>
        <div class="flex" style="flex-wrap: wrap">
          <button v-for="c in PRODUCT_COLORS" :key="c" type="button" class="swatch swatch--pick" :class="{ active: f.color === c }" :style="{ background: c }" @click="f.color = c" :aria-label="c"></button>
        </div>
      </div>
    </form>
    <template #footer>
      <button v-if="f.id" class="btn btn--danger" type="button" @click="remove"><Icon name="trash" :size="16" />Bỏ khỏi menu</button>
      <div class="spacer"></div>
      <button class="btn btn--ghost" type="button" @click="emit('close')">Huỷ</button>
      <button class="btn btn--primary" type="submit" form="pform">{{ f.id ? 'Lưu' : 'Thêm vào menu' }}</button>
    </template>
  </BaseModal>
</template>

<style lang="scss">
.swatch { width: 28px; height: 28px; border-radius: 8px; flex-shrink: 0; display: inline-block; }
.swatch--pick { border: 2px solid transparent; cursor: pointer; padding: 0; &.active { box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--text); } }
</style>
