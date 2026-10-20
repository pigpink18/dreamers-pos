<script setup>
/**
 * MÀN HÌNH BÁN HÀNG (POS)
 * - Trái: tìm & chọn hàng hoá
 * - Phải: giỏ hàng, nhiều tab hoá đơn cùng lúc (như KiotViet), thanh toán
 * Phím tắt: F3 tìm hàng · F9 thanh toán
 */
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import Icon from '../components/ui/Icon.vue'
import CustomerPicker from '../components/customers/CustomerPicker.vue'
import InvoiceDetailModal from '../components/invoices/InvoiceDetailModal.vue'
import ProductFormModal from '../components/products/ProductFormModal.vue'
import VietQrCard from '../components/payment/VietQrCard.vue'
import { useSettings } from '../stores/settings'
import { useProducts } from '../stores/products'
import { useInvoices, PAY_METHODS } from '../stores/invoices'
import { useCustomers } from '../stores/customers'
import { useUi } from '../stores/ui'
import { useAuth } from '../stores/auth'
import { useAudit } from '../stores/audit'
import { useStorage } from '../utils/storage'
import { money, number, normalize } from '../utils/format'
import { categoryIcon } from '../utils/category'
import { flyTo } from '../utils/motion'

const products = useProducts()
const invoices = useInvoices()
const customers = useCustomers()
const ui = useUi()
const auth = useAuth()
const audit = useAudit()

// ---------- Sửa menu ngay tại quầy (chủ quán / ai có quyền sửa hàng hoá) ----------
const canEditMenu = computed(() => auth.can('products.manage'))
const editMenu = ref(false)
const menuForm = ref(null) // { product } | { product: null } khi thêm mới
function onCard(p, e) {
  if (editMenu.value) menuForm.value = { product: p }
  else add(p, e)
}
async function quickRemove(p) {
  if (!(await ui.confirm(`Bỏ "${p.name}" khỏi menu? Lịch sử hoá đơn vẫn được giữ.`, { danger: true, okText: 'Bỏ khỏi menu' }))) return
  products.remove(p.id)
  ui.toast(`Đã bỏ ${p.name} khỏi menu`)
}

// Mã hoá đơn sắp tạo (để ghi vào nội dung chuyển khoản)
const settingsStore = useSettings()
const nextInvoiceCode = computed(() => 'HD' + String((settingsStore.counters.HD || 0) + 1).padStart(6, '0'))

// ---------- Danh sách hàng ----------
const q = ref('')
const cat = ref('')
const searchEl = ref(null)
const list = computed(() => {
  const k = normalize(q.value)
  return products.active.filter(
    (p) => (!cat.value || p.category === cat.value) && (!k || normalize(p.name).includes(k) || normalize(p.code).includes(k))
  )
})

// ---------- Các tab hoá đơn (lưu lại để F5 không mất giỏ) ----------
const newCart = (n) => ({ id: Date.now() + n, label: `Hoá đơn ${n}`, lines: [], customerId: null, discount: 0, method: 'cash', given: null, note: '' })
const carts = useStorage('pos-carts', [newCart(1)])
const activeIdx = useStorage('pos-active', 0)
if (!carts.value[activeIdx.value]) activeIdx.value = 0
const cart = computed(() => carts.value[activeIdx.value])

function addTab() {
  const n = Math.max(0, ...carts.value.map((c) => +c.label.replace(/\D/g, '') || 0)) + 1
  carts.value.push(newCart(n))
  activeIdx.value = carts.value.length - 1
}
async function closeTab(i) {
  if (carts.value[i].lines.length && !(await ui.confirm('Đóng hoá đơn đang có hàng?', { danger: true, okText: 'Đóng' }))) return
  carts.value.splice(i, 1)
  if (!carts.value.length) carts.value.push(newCart(1))
  activeIdx.value = Math.min(activeIdx.value, carts.value.length - 1)
}

// ---------- Giỏ hàng ----------
const inCart = (pid) => cart.value.lines.find((l) => l.productId === pid)?.qty || 0

function add(p, e) {
  const line = cart.value.lines.find((l) => l.productId === p.id)
  const want = (line?.qty || 0) + 1
  if (p.trackStock !== false && want > p.stock) {
    e?.currentTarget?.animate?.([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }], { duration: 300 })
    return ui.toast(`"${p.name}" chỉ còn ${p.stock} ${p.unit}`, 'error')
  }
  if (line) line.qty++
  else cart.value.lines.push({ productId: p.id, name: p.name, price: p.price, cost: p.cost, qty: 1, unit: p.unit })
  // Hiệu ứng: chấm màu món hàng bay vào giỏ
  const from = e?.currentTarget?.querySelector('.pcard__thumb')
  if (from) nextTick(() => {
    const mobile = window.matchMedia('(max-width: 760px)').matches
    const to = mobile ? document.querySelector('.cartbar') : document.querySelector(`.line[data-pid="${p.id}"]`) || document.querySelector('.cart__lines')
    flyTo(from, to, { color: p.color || 'var(--primary)' })
  })
}
function setQty(line, qty) {
  const p = products.byId(line.productId)
  qty = Math.max(0, Math.floor(+qty || 0))
  if (p && p.trackStock !== false && qty > p.stock) {
    ui.toast(`Chỉ còn ${p.stock} ${p.unit}`, 'error')
    qty = p.stock
  }
  if (qty === 0) cart.value.lines = cart.value.lines.filter((l) => l !== line)
  else line.qty = qty
}

const subtotal = computed(() => cart.value.lines.reduce((s, l) => s + l.price * l.qty, 0))
const discount = computed(() => Math.min(Math.max(0, +cart.value.discount || 0), subtotal.value))
const total = computed(() => subtotal.value - discount.value)
const given = computed(() => (cart.value.given === null || cart.value.given === '' ? total.value : +cart.value.given))
const change = computed(() => given.value - total.value)
const itemCount = computed(() => cart.value.lines.reduce((s, l) => s + l.qty, 0))

// Gợi ý tiền khách đưa: số tiền vừa đủ + các mệnh giá chẵn
const suggestions = computed(() => {
  const t = total.value
  if (!t) return []
  const set = new Set([t])
  ;[10000, 50000, 100000, 200000, 500000].forEach((u) => set.add(Math.ceil(t / u) * u))
  return [...set].sort((a, b) => a - b).slice(0, 5)
})

// ---------- Thanh toán ----------
const printedId = ref(null)
const cartOpen = ref(false) // điện thoại: giỏ hàng dạng tấm trượt
const autoPrint = ref(false)

const discountPct = computed(() => (subtotal.value ? (discount.value / subtotal.value) * 100 : 0))
const overLimit = computed(() => discount.value > 0 && (!auth.can('pos.discount') || discountPct.value > auth.maxDiscount))

let paying = false
async function checkout() {
  if (paying) return
  if (!cart.value.lines.length) return ui.toast('Chưa có hàng trong hoá đơn', 'error')
  if (cart.value.method === 'cash' && given.value < total.value) return ui.toast('Khách đưa chưa đủ tiền', 'error')
  paying = true
  try {
    // 1) Phải có ca đang mở (nếu cửa hàng bật quy tắc này)
    if (!(await ui.requireShift())) return
    // 2) Giảm giá vượt mức cho phép của vai trò -> cần người có mức cao hơn duyệt
    let approver = null
    if (overLimit.value) {
      const pct = Math.ceil(discountPct.value)
      approver = await ui.approve({
        perm: 'pos.discount',
        reason: `Giảm ${money(discount.value)} (${pct}%) — vượt mức ${auth.maxDiscount}% của ${auth.role?.name}`,
        check: (u) => (auth.roleById(u.roleId)?.maxDiscount ?? 0) >= pct,
      })
      if (!approver) return
      audit.log('invoice.discount', `Giảm ${money(discount.value)} (${pct}%) trên hoá đơn ${money(subtotal.value)}`, { approvedBy: approver })
    }
    doCheckout(approver)
  } finally {
    paying = false
  }
}

function doCheckout(approver) {
  const c = customers.byId(cart.value.customerId)
  const inv = invoices.create({
    discountApprovedBy: approver && approver.id !== auth.user?.id ? approver.name : null,
    items: cart.value.lines,
    customerId: c?.id,
    customerName: c?.name,
    discount: discount.value,
    method: cart.value.method,
    paid: cart.value.method === 'cash' ? given.value : total.value,
    note: cart.value.note,
  })
  ui.toast(`Thanh toán thành công ${inv.code}`)
  // Reset tab hiện tại
  Object.assign(cart.value, { lines: [], customerId: null, discount: 0, given: null, note: '', method: 'cash' })
  printedId.value = inv.id
  cartOpen.value = false
}

// ---------- Phím tắt ----------
function onKey(e) {
  if (e.key === 'F3') { e.preventDefault(); searchEl.value?.focus() }
  if (e.key === 'F9') { e.preventDefault(); checkout() }
}
function onSearchEnter() {
  if (list.value.length === 1 || (list.value[0] && normalize(list.value[0].code) === normalize(q.value))) {
    add(list.value[0])
    q.value = ''
  }
}
onMounted(() => {
  window.addEventListener('keydown', onKey)
  nextTick(() => searchEl.value?.focus())
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

const initials = (name) => name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
</script>

<template>
  <div class="pos">
    <!-- ===== Cột trái: hàng hoá ===== -->
    <section class="pos__catalog">
      <div class="pos__search">
        <div class="search" style="flex: 1">
          <input ref="searchEl" class="input input--lg" v-model="q" placeholder="Tìm hàng hoá theo tên hoặc mã (F3)" @keyup.enter="onSearchEnter" />
        </div>
        <button v-if="canEditMenu" class="btn btn--lg menu-toggle" :class="editMenu ? 'btn--primary' : 'btn--ghost'" @click="editMenu = !editMenu">
          <Icon :name="editMenu ? 'fa-check' : 'fa-pen-to-square'" :size="16" /><span>{{ editMenu ? 'Xong' : 'Sửa menu' }}</span>
        </button>
      </div>
      <div class="pos__cats">
        <button class="chip" :class="{ active: !cat }" @click="cat = ''">Tất cả</button>
        <button v-for="c in products.categories" :key="c" class="chip" :class="{ active: cat === c }" @click="cat = c">{{ c }}</button>
      </div>
      <div v-if="editMenu" class="menu-hint"><Icon name="fa-circle-info" :size="14" /><span>Đang sửa menu — chạm vào món để đổi tên, giá; bấm <b>−</b> để bỏ món. Bấm <b>Xong</b> để quay lại bán.</span></div>
      <div class="pos__grid" :class="{ 'is-editing': editMenu }">
        <button v-if="editMenu" class="pcard pcard--add" @click="menuForm = { product: null }">
          <span class="pcard__plus"><Icon name="plus" :size="22" /></span>
          <span>Thêm món</span>
          <small v-if="cat">vào nhóm {{ cat }}</small>
        </button>
        <button
          v-for="p in list" :key="p.id" class="pcard"
          :class="{ out: !editMenu && p.trackStock !== false && p.stock <= 0, picked: !editMenu && inCart(p.id) }"
          @click="onCard(p, $event)"
        >
          <span v-if="editMenu" class="pcard__del" role="button" :aria-label="`Bỏ ${p.name}`" @click.stop="quickRemove(p)"><Icon name="fa-minus" :size="12" /></span>
          <span v-if="editMenu" class="pcard__edit"><Icon name="edit" :size="13" /></span>
          <span v-else-if="inCart(p.id)" class="pcard__qty">{{ inCart(p.id) }}</span>
          <div class="pcard__thumb" :style="{ background: p.color || '#6366f1' }"><Icon :name="categoryIcon(p.category)" :size="30" /></div>
          <div class="pcard__name">{{ p.name }}</div>
          <div v-if="p.desc" class="pcard__desc" :title="p.desc">{{ p.desc }}</div>
          <div class="pcard__price num">{{ number(p.price) }}</div>
          <div class="pcard__stock" v-if="p.trackStock !== false">
            {{ p.stock <= 0 ? 'Hết hàng' : `Tồn: ${p.stock}` }}
          </div>
        </button>
        <div v-if="!list.length && !editMenu" class="empty" style="grid-column: 1/-1">Không tìm thấy hàng hoá</div>
      </div>
    </section>

    <!-- ===== Cột phải: hoá đơn ===== -->
    <!-- Điện thoại: thanh giỏ hàng nổi -->
    <button v-if="cart.lines.length" class="cartbar" @click="cartOpen = true">
      <span class="cartbar__count">{{ itemCount }}</span>
      <span>Xem giỏ hàng</span>
      <b class="num">{{ money(total) }}</b>
    </button>
    <div v-if="cartOpen" class="cart-scrim" @click="cartOpen = false"></div>

    <section class="pos__cart" :class="{ open: cartOpen }">
      <div class="sheet-grabber" @click="cartOpen = false"></div>
      <div class="tabs">
        <div v-for="(c, i) in carts" :key="c.id" class="tab" :class="{ active: i === activeIdx }" @click="activeIdx = i">
          {{ c.label }}<span v-if="c.lines.length" class="tab__count">{{ c.lines.length }}</span>
          <button class="tab__x" @click.stop="closeTab(i)" aria-label="Đóng tab"><Icon name="x" :size="12" /></button>
        </div>
        <button class="tab tab--add" @click="addTab" title="Thêm hoá đơn mới"><Icon name="plus" :size="14" /></button>
      </div>

      <div class="cart__customer"><CustomerPicker v-model="cart.customerId" /></div>

      <div class="cart__lines">
        <div v-if="!cart.lines.length" class="cart__empty">
          <Icon name="cart" :size="40" />
          <p>Chọn hàng hoá bên trái để thêm vào hoá đơn</p>
        </div>
        <div v-for="(l, i) in cart.lines" :key="l.productId" class="line" :data-pid="l.productId">
          <div class="line__idx">{{ i + 1 }}</div>
          <div class="line__info">
            <div class="line__name">{{ l.name }}</div>
            <div class="muted num">{{ number(l.price) }} / {{ l.unit }}</div>
          </div>
          <div class="stepper">
            <button @click="setQty(l, l.qty - 1)" aria-label="Giảm"><Icon name="minus" :size="14" /></button>
            <input :value="l.qty" @change="setQty(l, $event.target.value)" class="num" />
            <button @click="setQty(l, l.qty + 1)" aria-label="Tăng"><Icon name="plus" :size="14" /></button>
          </div>
          <div class="line__total num">{{ number(l.price * l.qty) }}</div>
          <button class="line__del" @click="setQty(l, 0)" aria-label="Xoá dòng"><Icon name="trash" :size="15" /></button>
        </div>
      </div>

      <div class="cart__summary">
        <div class="row"><span>Tổng tiền hàng <span class="muted">({{ itemCount }} món)</span></span><b class="num">{{ money(subtotal) }}</b></div>
        <div class="row">
          <span>Giảm giá
            <small v-if="discount > 0" class="disc-tag" :class="{ warn: overLimit }">
              {{ Math.round(discountPct) }}%<template v-if="overLimit"> · cần duyệt</template>
            </small>
          </span>
          <input class="input input--sm num text-right" type="number" min="0" step="1000" v-model.number="cart.discount" style="width: 130px" />
        </div>
        <div class="row row--total"><span>Khách cần trả</span><b class="num">{{ money(total) }}</b></div>

        <div class="segmented segmented--full">
          <button v-for="(lbl, k) in PAY_METHODS" :key="k" :class="{ active: cart.method === k }" @click="cart.method = k">{{ lbl }}</button>
        </div>

        <template v-if="cart.method === 'cash'">
          <div class="row">
            <span>Khách đưa</span>
            <input class="input input--sm num text-right" type="number" min="0" :placeholder="number(total)" v-model="cart.given" style="width: 130px" />
          </div>
          <div class="quick">
            <button v-for="s in suggestions" :key="s" class="chip" @click="cart.given = s">{{ number(s) }}</button>
          </div>
          <div class="row" v-if="total"><span>Tiền thừa trả khách</span><b class="num" :class="change < 0 ? 'text-danger' : 'text-success'">{{ money(change) }}</b></div>
        </template>

        <VietQrCard v-if="cart.method === 'transfer' && total > 0" :amount="total" :note="`${nextInvoiceCode} Dreamers`" :size="132" class="pos-qr" />

        <input class="input input--sm" v-model="cart.note" placeholder="Ghi chú hoá đơn..." />

        <button class="btn btn--primary btn--lg btn--block" :disabled="!cart.lines.length" @click="checkout">
          Thanh toán (F9) · {{ money(total) }}
        </button>
      </div>
    </section>

    <ProductFormModal v-if="menuForm" :product="menuForm.product" :category="cat" :track-stock="false" @close="menuForm = null" />
    <InvoiceDetailModal v-if="printedId" :invoice-id="printedId" :auto-print="autoPrint" @close="printedId = null" />
  </div>
</template>

<style lang="scss">
@use '../styles/tokens' as *;

.pos {
  display: grid; grid-template-columns: 1fr 400px; gap: 16px; height: 100%; padding: 0 16px 16px 32px;
  &__catalog { display: flex; flex-direction: column; min-height: 0; min-width: 0; padding-top: 8px; }
  &__search { display: flex; gap: 10px; }
  &__cats { display: flex; gap: 8px; margin: 14px 0; overflow-x: auto; scrollbar-width: none; padding: 2px; &::-webkit-scrollbar { display: none; } }
  &__grid {
    flex: 1; overflow-y: auto; padding: 2px 2px 20px;
    display: grid; grid-template-columns: repeat(auto-fill, minmax(156px, 1fr)); gap: 12px; align-content: start;
  }
  &__cart {
    display: flex; flex-direction: column; min-height: 0; overflow: hidden;
    background: $surface; border-radius: $radius-lg; box-shadow: $shadow;
  }
}
.input--lg { height: 44px; font-size: 15px; border-radius: 12px; }
.input--sm { height: 34px; }

// ---- Thẻ món ----
.pcard {
  position: relative; min-width: 0; display: flex; flex-direction: column; gap: 4px; text-align: left; font: inherit; color: $text; cursor: pointer;
  background: $surface; border: 0; border-radius: 16px; padding: 12px; box-shadow: $shadow-sm, 0 0 0 .5px $border;
  transition: transform .2s $spring, box-shadow .2s;
  &:hover { box-shadow: $shadow; transform: translateY(-2px); }
  &:active { transform: scale(.96); transition-duration: .08s; }
  &.picked { box-shadow: 0 0 0 2px $primary, $shadow; }
  &.out { opacity: .45; }
  &__thumb {
    height: 76px; border-radius: 12px; display: grid; place-items: center; color: #fff; margin-bottom: 6px;
    background-image: linear-gradient(180deg, rgba(255,255,255,.18), rgba(0,0,0,.06)) !important;
    background-blend-mode: normal;
  }
  &__name { font-weight: 600; line-height: 1.3; min-height: 36px; letter-spacing: -0.01em; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  &__desc { font-size: 11px; line-height: 1.3; color: $text-muted; margin-top: -2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  &__price { font-weight: 700; font-size: 15px; margin-top: auto; }
  &__stock { font-size: 12px; color: $text-muted; }
  &__qty {
    position: absolute; top: 8px; right: 8px; min-width: 24px; height: 24px; padding: 0 7px; border-radius: 999px;
    background: $primary; color: $on-primary; font-size: 12px; font-weight: 700; display: grid; place-items: center;
    box-shadow: 0 0 0 2px $surface; animation: bump .35s $spring;
  }
}
@keyframes bump { from { transform: scale(.3); } }
.pos-qr { animation: fadeRow .3s ease-out; }

// ---- Chế độ sửa menu ----
.menu-toggle { flex-shrink: 0; height: 44px; border-radius: 12px; }
.menu-hint { display: flex; align-items: center; gap: 8px; margin: -4px 0 12px; padding: 10px 14px; border-radius: 12px; background: $fill; color: $text-2; font-size: 13px; }
.pcard__del, .pcard__edit {
  position: absolute; top: 8px; width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; z-index: 1;
  animation: bump .3s $spring;
}
.pcard__del { left: 8px; background: $danger; color: #fff; box-shadow: 0 0 0 2px $surface; cursor: pointer;
  &:hover { transform: scale(1.1); } }
.pcard__edit { right: 8px; background: $surface; color: $text-2; box-shadow: $shadow-sm; }
.is-editing .pcard:not(.pcard--add) { animation: wiggle .5s ease-in-out infinite alternate; &:nth-child(2n) { animation-delay: -.25s; } }
@keyframes wiggle { from { transform: rotate(-.6deg); } to { transform: rotate(.6deg); } }
[data-motion='off'] .is-editing .pcard, [data-motion='reduced'] .is-editing .pcard { animation: none; }
.pcard--add {
  align-items: center; justify-content: center; gap: 6px; min-height: 160px; text-align: center; color: $primary; font-weight: 600;
  background: transparent; box-shadow: none; border: 1.5px dashed $border-strong;
  &:hover { background: $primary-soft; border-color: $primary; box-shadow: none; }
  small { font-weight: 400; color: $text-muted; font-size: 12px; }
}
.pcard__plus { width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; background: $primary-soft; }

// ---- Tabs hoá đơn ----
.tabs {
  display: flex; gap: 4px; padding: 10px; overflow-x: auto; flex-shrink: 0; border-bottom: 1px solid $border;
  .tab {
    display: flex; align-items: center; gap: 6px; height: 30px; padding: 0 6px 0 12px; border-radius: 8px;
    font: inherit; font-size: 13px; font-weight: 500; color: $text-2; cursor: pointer; white-space: nowrap; border: 0; background: transparent;
    &:hover { background: $fill; }
    &.active { background: $fill-2; color: $text; font-weight: 600; }
    &--add { padding: 0 10px; color: $primary; }
    &__count { font-size: 11px; background: $primary; color: $on-primary; border-radius: 999px; padding: 0 6px; font-weight: 600; }
    &__x { border: 0; background: transparent; color: $text-muted; cursor: pointer; display: grid; padding: 3px; border-radius: 4px; &:hover { color: $danger; } }
  }
}
.cart__customer { padding: 12px 14px; }
.cart__lines { flex: 1; overflow-y: auto; padding: 0 6px; }
.cart__empty { height: 100%; min-height: 120px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: $text-muted; text-align: center; padding: 20px; p { max-width: 220px; } .icon { opacity: .5; } }
.line {
  display: flex; align-items: center; gap: 10px; padding: 10px 8px;
  & + & { border-top: 1px solid $border; }
  &__idx { width: 16px; color: $text-muted; font-size: 12px; }
  &__info { flex: 1; min-width: 0; font-size: 12px; }
  &__name { font-weight: 600; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  &__total { width: 72px; text-align: right; font-weight: 600; }
  &__del { border: 0; background: transparent; color: $text-muted; cursor: pointer; padding: 5px; border-radius: 6px; display: grid; &:hover { color: $danger; background: $danger-soft; } }
}
// Bộ tăng giảm kiểu UIStepper của iOS
.stepper {
  display: flex; align-items: center; background: $fill; border-radius: 9px; padding: 2px;
  button { width: 28px; height: 26px; border: 0; border-radius: 7px; background: transparent; cursor: pointer; display: grid; place-items: center; color: $text; &:active { background: $surface; } }
  input { width: 30px; height: 26px; border: 0; background: transparent; text-align: center; font: inherit; font-weight: 600; color: $text; &:focus { outline: none; } }
}
.cart__summary {
  padding: 14px 16px 16px; border-top: 1px solid $border; display: flex; flex-direction: column; gap: 10px; background: $surface-2;
  .row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .row--total { padding: 2px 0; span { font-weight: 600; } b { font-family: $font-display; font-size: 26px; font-weight: 700; letter-spacing: -0.025em; } }
  .quick { display: flex; gap: 6px; flex-wrap: wrap; .chip { height: 28px; font-size: 12px; padding: 0 10px; } }
}
.segmented--full { display: flex; button { flex: 1; } }
.disc-tag { margin-left: 6px; padding: 1px 7px; border-radius: 6px; font-size: 11px; font-weight: 600; background: $fill; color: $text-2; &.warn { background: $warning-soft; color: $warning; } }
.sheet-grabber, .cartbar, .cart-scrim { display: none; }

@media (max-width: 1200px) { .pos { grid-template-columns: 1fr 360px; } }
@include tablet { .pos { padding: 0 16px 16px; } }

// ---- Điện thoại: lưới món toàn màn hình, giỏ hàng là tấm trượt ----
@include mobile {
  .menu-toggle { width: 44px; padding: 0; justify-content: center; span { display: none; } }
  .pcard--add { min-height: 140px; }
  .pos { grid-template-columns: 1fr; padding: 0 12px; gap: 0; }
  .pos__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; padding-bottom: 84px; }
  .pcard__thumb { height: 64px; }
  .cartbar {
    display: flex; align-items: center; gap: 10px; position: fixed; z-index: 55;
    left: 12px; right: 12px; bottom: calc(#{$tabbar-h} + var(--safe-bottom) + 2px);
    height: 52px; padding: 0 16px 0 10px; border: 0; border-radius: 14px; cursor: pointer;
    background: $primary; color: $on-primary; font: inherit; font-size: 15px; font-weight: 600;
    box-shadow: 0 8px 24px tint($primary, .4); animation: sheetUp .35s $ease-out;
    b { margin-left: auto; }
  }
  .cartbar__count { min-width: 32px; height: 32px; border-radius: 9px; background: rgba(255,255,255,.2); display: grid; place-items: center; }
  .cart-scrim { display: block; position: fixed; inset: 0; z-index: 90; background: rgba(0,0,0,.28); animation: fade .2s; }
  .pos__cart {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 95; height: 88dvh;
    border-radius: 16px 16px 0 0; box-shadow: $shadow-lg;
    transform: translateY(105%); transition: transform .4s $ease-out;
    padding-bottom: var(--safe-bottom);
    &.open { transform: none; }
  }
  .sheet-grabber { display: block; flex-shrink: 0; width: 36px; height: 5px; border-radius: 3px; background: rgba(0,0,0,.18); margin: 8px auto 0; }
}
</style>
