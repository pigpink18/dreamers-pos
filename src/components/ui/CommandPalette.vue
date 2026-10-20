<script setup>
/**
 * SPOTLIGHT (⌘K / Ctrl+K): tìm nhanh trang, thao tác, khách hàng, hàng hoá, hoá đơn.
 * Điều khiển hoàn toàn bằng bàn phím: ↑ ↓ để chọn, Enter để mở, Esc để đóng.
 */
import { ref, computed, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import Icon from './Icon.vue'
import InvoiceDetailModal from '../invoices/InvoiceDetailModal.vue'
import { useProducts } from '../../stores/products'
import { useCustomers } from '../../stores/customers'
import { useInvoices } from '../../stores/invoices'
import { useRooms, ROOM_STATUS } from '../../stores/rooms'
import { useTheme } from '../../stores/theme'
import { normalize, money } from '../../utils/format'

const open = defineModel({ type: Boolean })
const router = useRouter()
const products = useProducts()
const customers = useCustomers()
const invoices = useInvoices()
const rooms = useRooms()
const theme = useTheme()

const q = ref('')
const idx = ref(0)
const inputEl = ref(null)
const listEl = ref(null)
const invoiceId = ref(null)

watch(open, async (v) => {
  if (!v) return
  q.value = ''
  idx.value = 0
  await nextTick()
  inputEl.value?.focus()
})

const go = (path) => () => router.push(path)

const groups = computed(() => {
  const k = normalize(q.value.trim())
  const match = (...fields) => !k || fields.some((f) => normalize(f || '').includes(k))
  const out = []

  const pages = router.getRoutes()
    .filter((r) => r.meta?.title && match(r.meta.title))
    .map((r) => ({ id: r.path, icon: r.meta.icon, title: r.meta.title, sub: 'Mở trang', run: go(r.path) }))
  const actions = [
    { id: 'a-pos', icon: 'cart', title: 'Tạo hoá đơn bán hàng', sub: 'Màn hình POS', run: go('/pos') },
    { id: 'a-book', icon: 'calendar', title: 'Đặt phòng mới', sub: 'Lịch đặt phòng', run: go('/bookings') },
    { id: 'a-import', icon: 'upload', title: 'Nhập hàng vào kho', sub: 'Hàng hoá & kho', run: go('/products') },
    { id: 'a-report', icon: 'chart', title: 'Báo cáo doanh thu hôm nay', sub: 'Báo cáo', run: go('/reports') },
    {
      id: 'a-theme', icon: theme.resolved === 'dark' ? 'sun' : 'moon',
      title: theme.resolved === 'dark' ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang giao diện Tối', sub: 'Giao diện',
      run: () => (theme.mode = theme.resolved === 'dark' ? 'light' : 'dark'),
    },
  ].filter((a) => match(a.title, a.sub))

  if (!k) {
    out.push({ label: 'Thao tác nhanh', items: actions })
    out.push({ label: 'Đi tới', items: pages })
    return out
  }
  if (actions.length) out.push({ label: 'Thao tác', items: actions })
  if (pages.length) out.push({ label: 'Trang', items: pages })

  const rs = rooms.rooms.filter((r) => match('phong ' + r.name, r.type)).slice(0, 4)
  if (rs.length) out.push({ label: 'Phòng', items: rs.map((r) => ({ id: r.id, icon: 'bed', title: `Phòng ${r.name}`, sub: `${r.type} · ${ROOM_STATUS[rooms.statusOf(r)].label}`, run: go('/rooms') })) })

  const cs = customers.items.filter((c) => match(c.name, c.phone, c.code)).slice(0, 5)
  if (cs.length) out.push({ label: 'Khách hàng', items: cs.map((c) => ({ id: c.id, icon: 'users', title: c.name, sub: [c.code, c.phone].filter(Boolean).join(' · '), run: go('/customers') })) })

  const ps = products.active.filter((p) => match(p.name, p.code, p.category)).slice(0, 5)
  if (ps.length) out.push({ label: 'Hàng hoá', items: ps.map((p) => ({ id: p.id, icon: 'box', title: p.name, sub: `${money(p.price)} · ${p.trackStock === false ? 'Dịch vụ' : 'Tồn ' + p.stock}`, run: go('/products') })) })

  if (k.length >= 3) {
    const is = invoices.items.filter((i) => match(i.code)).slice(0, 5)
    if (is.length) out.push({ label: 'Hoá đơn', items: is.map((i) => ({ id: i.id, icon: 'receipt', title: i.code, sub: `${i.customerName} · ${money(i.total)}`, run: () => (invoiceId.value = i.id) })) })
  }
  return out
})
const flat = computed(() => groups.value.flatMap((g) => g.items))
watch(q, () => (idx.value = 0))

function run(item) {
  open.value = false
  item.run()
}
function onKey(e) {
  if (e.key === 'ArrowDown') { e.preventDefault(); idx.value = (idx.value + 1) % Math.max(1, flat.value.length) }
  else if (e.key === 'ArrowUp') { e.preventDefault(); idx.value = (idx.value - 1 + flat.value.length) % Math.max(1, flat.value.length) }
  else if (e.key === 'Enter') { e.preventDefault(); flat.value[idx.value] && run(flat.value[idx.value]) }
  else if (e.key === 'Escape') open.value = false
  else return
  nextTick(() => listEl.value?.querySelector('.cp-item.active')?.scrollIntoView({ block: 'nearest' }))
}
const indexOf = (item) => flat.value.indexOf(item)
</script>

<template>
  <Teleport to="body">
    <Transition name="cp">
      <div v-if="open" class="cp-backdrop" @mousedown.self="open = false">
        <div class="cp" role="dialog" aria-label="Tìm kiếm nhanh">
          <div class="cp-input">
            <Icon name="search" :size="20" />
            <input ref="inputEl" v-model="q" placeholder="Tìm trang, khách hàng, hàng hoá, mã hoá đơn…" @keydown="onKey" />
            <kbd>esc</kbd>
          </div>
          <div class="cp-list" ref="listEl">
            <template v-for="g in groups" :key="g.label">
              <div class="cp-group">{{ g.label }}</div>
              <button
                v-for="item in g.items" :key="item.id" class="cp-item" :class="{ active: indexOf(item) === idx }"
                @mousemove="idx = indexOf(item)" @click="run(item)"
              >
                <span class="cp-icon"><Icon :name="item.icon" :size="16" /></span>
                <span class="cp-text"><b>{{ item.title }}</b><small>{{ item.sub }}</small></span>
                <Icon v-if="indexOf(item) === idx" name="enter" :size="15" class="cp-enter" />
              </button>
            </template>
            <div v-if="!flat.length" class="cp-empty">Không tìm thấy kết quả cho “{{ q }}”</div>
          </div>
          <div class="cp-foot"><span><kbd>↑</kbd><kbd>↓</kbd> chọn</span><span><kbd>↵</kbd> mở</span><span><kbd>⌘</kbd><kbd>K</kbd> bật/tắt</span></div>
        </div>
      </div>
    </Transition>
  </Teleport>
  <InvoiceDetailModal v-if="invoiceId" :invoice-id="invoiceId" @close="invoiceId = null" />
</template>

<style lang="scss">
@use '../../styles/tokens' as *;
.cp-backdrop {
  position: fixed; inset: 0; z-index: 180; display: flex; justify-content: center; align-items: flex-start; padding: 12vh 16px 0;
  background: rgba(0, 0, 0, .18); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
}
.cp {
  width: 100%; max-width: 640px; overflow: hidden; border-radius: 22px;
  background: var(--glass-strong); backdrop-filter: blur(50px) saturate(200%); -webkit-backdrop-filter: blur(50px) saturate(200%);
  border: 1px solid var(--glass-border); box-shadow: var(--glass-highlight), var(--shadow-lg);
}
.cp-input {
  display: flex; align-items: center; gap: 12px; padding: 0 18px; height: 60px; border-bottom: 1px solid $border; color: $text-muted;
  input { flex: 1; border: 0; background: transparent; font: inherit; font-size: 19px; color: $text; letter-spacing: -0.01em; &:focus { outline: none; } &::placeholder { color: $text-muted; } }
}
kbd {
  display: inline-grid; place-items: center; min-width: 22px; height: 20px; padding: 0 5px; margin: 0 2px;
  font: 600 11px $font-family; color: $text-2; background: var(--surface-2); border-radius: 6px; border: 1px solid $border;
}
.cp-list { max-height: 52vh; overflow-y: auto; padding: 6px 8px 8px; }
.cp-group { font-size: 12px; font-weight: 600; color: $text-muted; padding: 12px 10px 6px; }
.cp-item {
  display: flex; align-items: center; gap: 12px; width: 100%; padding: 8px 10px; border: 0; border-radius: 12px;
  background: transparent; font: inherit; color: $text; text-align: left; cursor: pointer;
  &.active { background: var(--accent-soft); .cp-icon { background: var(--accent); color: var(--on-accent); } }
}
.cp-icon { width: 32px; height: 32px; border-radius: 9px; display: grid; place-items: center; background: var(--surface-2); color: $text-2; flex-shrink: 0; }
.cp-text { display: flex; flex-direction: column; min-width: 0; flex: 1; b { font-weight: 600; } small { color: $text-muted; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } }
.cp-enter { opacity: .85; }
.cp-empty { padding: 36px; text-align: center; color: $text-muted; }
.cp-foot { display: flex; gap: 18px; padding: 10px 18px; border-top: 1px solid $border; font-size: 12px; color: $text-muted; }
.cp-enter-active { transition: opacity .2s; .cp { transition: transform .35s $ease-spring, opacity .2s; } }
.cp-leave-active { transition: opacity .15s; .cp { transition: transform .15s, opacity .15s; } }
.cp-enter-from, .cp-leave-to { opacity: 0; .cp { transform: scale(.95) translateY(-10px); opacity: 0; } }
</style>
