<script setup>
/**
 * CÀI ĐẶT — chia tab, mỗi tab chỉ hiện với người có quyền:
 *  Giao diện (ai cũng chỉnh được cho máy mình) · Cửa hàng · Người dùng · Phân quyền · Vận hành · Dữ liệu
 */
import { reactive, ref, computed, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Icon from '../components/ui/Icon.vue'
import BaseModal from '../components/ui/BaseModal.vue'
import AppSelect from '../components/ui/AppSelect.vue'
import PaymentSettings from '../components/settings/PaymentSettings.vue'
import ServerSettings from '../components/settings/ServerSettings.vue'
import EinvoiceSettings from '../components/settings/EinvoiceSettings.vue'
import ChannelSettings from '../components/settings/ChannelSettings.vue'
import PrinterSettings from '../components/settings/PrinterSettings.vue'
import { useSettings } from '../stores/settings'
import { useUi } from '../stores/ui'
import { useAuth, PERMISSION_GROUPS, initials } from '../stores/auth'
import { useAudit } from '../stores/audit'
import { useAppearance, THEMES, LAYOUTS, MOTIONS } from '../stores/theme'
import { clearAll, exportAll, importAll, markSeeded } from '../utils/storage'
import { nsKey, isLegacy, activeShop, activeShopId, setActiveShop, platformConfigured } from '../tenant'
import { download, dateKey, fmtDate } from '../utils/format'

const settings = useSettings()
const ui = useUi()
const auth = useAuth()
const audit = useAudit()
const appearance = useAppearance()
const route = useRoute()
const router = useRouter()

const TABS = [
  { key: 'appearance', label: 'Giao diện', icon: 'fa-palette' },
  { key: 'shop', label: 'Cửa hàng', icon: 'fa-store', perm: 'settings.manage' },
  { key: 'users', label: 'Người dùng', icon: 'users', perm: 'users.manage' },
  { key: 'roles', label: 'Phân quyền', icon: 'fa-user-shield', perm: 'roles.manage' },
  { key: 'payment', label: 'Thanh toán', icon: 'fa-qrcode', perm: 'settings.manage' },
  { key: 'einvoice', label: 'Hoá đơn điện tử', icon: 'fa-file-invoice', perm: 'settings.manage' },
  { key: 'channels', label: 'Kênh đặt phòng', icon: 'fa-calendar-arrow-down', perm: 'settings.manage' },
  { key: 'server', label: 'Tài khoản & đồng bộ', icon: 'fa-cloud', perm: 'settings.manage' },
  { key: 'ops', label: 'Vận hành', icon: 'fa-sliders', perm: 'settings.manage' },
  { key: 'data', label: 'Dữ liệu', icon: 'fa-database', perm: 'settings.manage' },
]
const tabs = computed(() => TABS.filter((t) => !t.perm || auth.can(t.perm)))
const tab = computed({
  get: () => (tabs.value.some((t) => t.key === route.query.tab) ? route.query.tab : tabs.value[0].key),
  set: (v) => router.replace({ query: { tab: v } }),
})

// ---------------- Cửa hàng ----------------
const shop = reactive({ ...settings.shop })
function saveShop() {
  Object.assign(settings.shop, shop)
  // Quán trên hệ thống: đổi tên quán ở cả danh sách quán của tài khoản
  if (!isLegacy && shop.name?.trim() && shop.name.trim() !== activeShop?.name) {
    import('../sync/connection').then((m) => m.renameShop(activeShopId, shop.name)).then(
      () => setActiveShop({ id: activeShopId, name: shop.name.trim() }),
      (e) => ui.toast('Chưa đổi được tên quán trên máy chủ: ' + e.message, 'error'),
    )
  }
  audit.log('settings.update', 'Sửa thông tin cửa hàng')
  ui.toast('Đã lưu thông tin cửa hàng')
}

// ---------------- Người dùng ----------------
// Hệ thống nhiều quán: người dùng có thể thêm email (không bắt buộc) để tự đăng nhập app trên điện thoại riêng.
// Không có email = chỉ vào ca bằng PIN trên máy của quán như trước.
const emailMode = !isLegacy && platformConfigured()
const canShare = typeof navigator !== 'undefined' && !!navigator.share
const members = ref({}) // email -> { status: 'member'|'invited', token, role }
const invite = ref(null) // { name, email, link } -> hộp gửi link mời
async function loadMembers() {
  if (!emailMode || !auth.can('settings.manage')) return
  try {
    const { listMembers } = await import('../sync/connection')
    members.value = Object.fromEntries((await listMembers()).map((m) => [m.email, m]))
  } catch { /* mất mạng / không có quyền: không hiện trạng thái */ }
}
watch(() => tab.value, (t) => t === 'users' && loadMembers(), { immediate: true })
const memberOf = (u) => (u.email ? members.value[u.email.toLowerCase()] : null)
async function showInvite(u) {
  const m = memberOf(u)
  const { inviteLink } = await import('../sync/connection')
  if (m?.token) invite.value = { name: u.name, email: u.email, link: inviteLink(m.token) }
}
async function syncInvite(u, oldEmail) {
  if (!emailMode) return
  const conn = await import('../sync/connection')
  try {
    if (oldEmail && oldEmail !== u.email) await conn.removeMember(oldEmail)
    if (u.email && u.active !== false) {
      const r = await conn.inviteMember(u.email, u.roleId, u.id)
      if (r.status === 'invited') invite.value = { name: u.name, email: u.email, link: r.link }
      else ui.toast(`Đã cập nhật quyền của ${u.email}`)
    } else if (u.email && u.active === false) await conn.removeMember(u.email)
  } catch (e) {
    ui.toast('Chưa gửi được lời mời: ' + e.message, 'error')
  }
  loadMembers()
}
async function copyInvite() {
  try { await navigator.clipboard.writeText(invite.value.link); ui.toast('Đã sao chép link mời') }
  catch { ui.toast('Không sao chép được — chọn và copy thủ công', 'error') }
}
async function shareInvite() {
  try { await navigator.share({ title: 'Lời mời vào quán', text: `Mời ${invite.value.name} vào quán ${settings.shop.name}. Đăng ký / đăng nhập bằng ${invite.value.email}:`, url: invite.value.link }) } catch { /* huỷ chia sẻ */ }
}

const userForm = ref(null)
function openUser(u) {
  userForm.value = reactive(u ? { id: u.id, name: u.name, roleId: u.roleId, phone: u.phone || '', email: u.email || '', pin: '' } : { name: '', roleId: 'staff', phone: '', email: '', pin: '' })
}
function saveUser() {
  const f = userForm.value
  if (!f.name.trim()) return ui.toast('Nhập tên người dùng', 'error')
  if (f.pin && !/^\d{6}$/.test(f.pin)) return ui.toast('PIN gồm đúng 6 chữ số', 'error')
  const email = (f.email || '').trim().toLowerCase()
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return ui.toast('Email không hợp lệ', 'error')
  if (email && auth.users.some((x) => x.id !== f.id && (x.email || '').toLowerCase() === email)) return ui.toast('Email này đã gắn với người dùng khác', 'error')
  const oldEmail = f.id ? (auth.userById(f.id)?.email || '') : ''
  const oldRole = f.id ? auth.userById(f.id)?.roleId : null
  try {
    const u = auth.saveUser({ ...f, name: f.name.trim(), email, pin: f.pin || undefined })
    ui.toast(f.id ? 'Đã cập nhật người dùng' : `Đã thêm ${f.name}`)
    userForm.value = null
    if (emailMode && (email !== oldEmail || (email && u.roleId !== oldRole))) syncInvite(u, oldEmail)
  } catch (e) {
    ui.toast(e.message, 'error')
  }
}
async function toggleUser(u) {
  if (u.id === auth.user?.id) return ui.toast('Không thể khoá chính tài khoản đang dùng', 'error')
  const on = u.active === false
  if (!on && !(await ui.confirm(`Khoá tài khoản ${u.name}? Người này sẽ không đăng nhập được nữa${u.email ? ' (kể cả trên điện thoại riêng bằng email)' : ''}.`, { danger: true, okText: 'Khoá tài khoản' }))) return
  try {
    auth.setActive(u.id, on)
    ui.toast(on ? 'Đã mở khoá tài khoản' : 'Đã khoá tài khoản')
    if (u.email) syncInvite(u)
  } catch (e) { ui.toast(e.message, 'error') }
}
const roleOptions = computed(() => auth.roles.map((r) => ({ value: r.id, label: r.name })))

// ---------------- Phân quyền ----------------
const roleId = ref('staff')
const editRole = computed(() => auth.roleById(roleId.value))
function togglePerm(p) {
  const r = editRole.value
  if (r.id === 'owner') return ui.toast('Chủ quán luôn có toàn quyền', 'error')
  const has = r.permissions.includes(p)
  r.permissions = has ? r.permissions.filter((x) => x !== p) : [...r.permissions, p]
  auth.saveRole({ id: r.id, permissions: r.permissions })
}
function setDiscount(v) {
  auth.saveRole({ id: editRole.value.id, maxDiscount: Math.max(0, Math.min(100, +v || 0)) })
}
const newRole = ref(null)
function addRole() {
  if (!newRole.value?.trim()) return
  const r = auth.saveRole({ name: newRole.value.trim(), permissions: ['dashboard.view'], maxDiscount: 0 })
  roleId.value = r.id
  newRole.value = null
}
async function removeRole() {
  if (!(await ui.confirm(`Xoá vai trò ${editRole.value.name}?`, { danger: true, okText: 'Xoá' }))) return
  try { auth.removeRole(editRole.value.id); roleId.value = 'staff' } catch (e) { ui.toast(e.message, 'error') }
}
const usersInRole = (id) => auth.users.filter((u) => u.roleId === id && u.active !== false).length

// ---------------- Vận hành ----------------
watch(() => ({ ...settings.ops }), (v, o) => {
  if (o && (v.requireShift !== o.requireShift || v.autoLockMin !== o.autoLockMin))
    audit.log('settings.update', `Vận hành: bắt buộc mở ca ${v.requireShift ? 'BẬT' : 'TẮT'} · tự khoá ${v.autoLockMin || 'tắt'} phút`)
}, { deep: true })

// ---------------- Dữ liệu ----------------
const fileEl = ref(null)
function backup() {
  download(`dreamers-pos-backup_${dateKey()}.json`, JSON.stringify(exportAll(), null, 2), 'application/json')
}
function restore(e) {
  const f = e.target.files[0]
  if (!f) return
  const reader = new FileReader()
  reader.onload = async () => {
    try {
      const data = JSON.parse(reader.result)
      if (!(await ui.confirm('Khôi phục sẽ ghi đè toàn bộ dữ liệu hiện tại. Tiếp tục?', { danger: true, okText: 'Khôi phục' }))) return
      // ghi nhật ký vào chính dữ liệu được khôi phục, đợi các thay đổi đang chờ lưu xong rồi mới ghi đè
      audit.log('data.restore', `Khôi phục từ file ${f.name}`)
      const entry = audit.entries[0]
      await nextTick()
      const all = { ...data, audit: [entry, ...(Array.isArray(data.audit) ? data.audit : [])] }
      if (isLegacy) importAll(all)
      else await restoreShop(all)
      location.reload()
    } catch {
      ui.toast('File sao lưu không hợp lệ', 'error')
    }
  }
  reader.readAsText(f)
  e.target.value = ''
}
/**
 * Quán trên hệ thống: khôi phục / xoá phải đi qua bộ đồng bộ (gán lại dữ liệu trong app) để máy chủ
 * và các máy khác của quán cập nhật theo — không chỉ ghi đè localStorage của máy này.
 */
async function restoreShop(all) {
  const { sync, SYNC_KEYS } = await import('../sync/engine')
  Object.entries(all).forEach(([k, v]) => {
    if (k.startsWith('sync:') || ['session', 'init', 'appearance'].includes(k)) return
    const r = sync.registry.get(k)
    if (r && SYNC_KEYS.includes(k)) r.value = v
    else localStorage.setItem(nsKey(k), JSON.stringify(v))
  })
  // bản ghi có trong máy chủ mà không có trong file -> bộ đồng bộ hiểu là đã xoá
  await new Promise((r) => setTimeout(r, 600))
  await sync.flush()
}
async function wipeShop() {
  const { sync } = await import('../sync/engine')
  ;['products', 'imports', 'customers', 'invoices', 'rooms', 'bookings', 'shifts', 'audit'].forEach((k) => {
    const r = sync.registry.get(k)
    if (r) r.value = []
  })
  await new Promise((r) => setTimeout(r, 600))
  await sync.flush()
}
/** Quán Dreamers lỡ tạo trống: bổ sung menu + 7 phòng + tài khoản MB + nhân viên Lam (không ghi đè cái đã có) */
async function loadDreamers() {
  if (!(await ui.confirm('Thêm menu Dreamers, 7 phòng, tài khoản MB nhận chuyển khoản và nhân viên Lam vào quán này? Món / phòng đã có sẽ được giữ nguyên.', { okText: 'Thêm vào quán' }))) return
  const { applyDreamersTemplate } = await import('../stores/seed')
  applyDreamersTemplate()
  useAudit().log('settings.update', 'Nạp menu & 7 phòng Dreamers')
  ui.toast('Đã thêm menu và 7 phòng Dreamers')
}
async function wipe(withDemo) {
  const msg = withDemo
    ? 'Xoá hết và nạp dữ liệu mẫu (món, phòng, hoá đơn 150 ngày) để xem thử?'
    : 'Xoá toàn bộ hàng hoá, hoá đơn, phòng, khách, ca làm việc để bắt đầu dùng thật? Giữ lại người dùng, phân quyền và giao diện. Không thể hoàn tác.'
  if (!(await ui.confirm(msg, { danger: true, okText: 'Xoá dữ liệu' }))) return
  const approver = await ui.approve({ perm: 'settings.manage', reason: 'Xoá dữ liệu cửa hàng' })
  if (!approver) return
  if (withDemo) localStorage.setItem(nsKey('wantDemo'), '1') // main.js xoá hết rồi nạp dữ liệu mẫu
  else if (!isLegacy) {
    await wipeShop()
    settings.ops.demo = false
    useAudit().log('data.reset', 'Xoá dữ liệu để bắt đầu dùng thật', { approvedBy: approver })
    await new Promise((r) => setTimeout(r, 600))
  } else {
    clearAll(['users', 'roles', 'session', 'appearance', 'shop', 'ops'])
    settings.ops.demo = false
    markSeeded()
    useAudit().log('data.reset', 'Xoá dữ liệu để bắt đầu dùng thật', { approvedBy: approver })
  }
  location.reload()
}
</script>

<template>
  <div class="page settings">
    <div class="page-header"><div><h1>Cài đặt</h1><p>Giao diện, người dùng, phân quyền và quy tắc vận hành</p></div></div>

    <div class="settings__layout">
      <nav class="settings__tabs">
        <button v-for="t in tabs" :key="t.key" :class="{ active: tab === t.key }" @click="tab = t.key">
          <Icon :name="t.icon" :size="16" /> {{ t.label }}
        </button>
      </nav>

      <div class="settings__body">
        <!-- ============ GIAO DIỆN ============ -->
        <template v-if="tab === 'appearance'">
          <section class="card">
            <div class="card__header"><h3>Chủ đề màu</h3><span class="muted">Áp dụng cho máy này</span></div>
            <div class="card__body theme-grid">
              <button v-for="(t, k) in THEMES" :key="k" class="theme-card" :class="{ active: appearance.prefs.theme === k }" @click="appearance.prefs.theme = k">
                <div class="theme-card__preview" :style="{ background: t.swatch[0] }">
                  <div class="tp-side" :style="{ background: t.swatch[1] }">
                    <i :style="{ background: t.swatch[2] }"></i><i></i><i></i>
                  </div>
                  <div class="tp-main">
                    <div class="tp-card" :style="{ background: t.swatch[1] }"><i :style="{ background: t.swatch[2] }"></i></div>
                    <div class="tp-card" :style="{ background: t.swatch[1] }"></div>
                  </div>
                </div>
                <div class="theme-card__meta">
                  <b>{{ t.name }}</b><small>{{ t.desc }}</small>
                  <Icon v-if="appearance.prefs.theme === k" name="fa-circle-check" :size="18" class="theme-card__check" />
                </div>
              </button>
            </div>
          </section>

          <section class="card mt-16">
            <div class="card__header"><h3>Kiểu menu</h3><span class="muted">Trên điện thoại luôn dùng thanh tab dưới đáy</span></div>
            <div class="card__body theme-grid">
              <button v-for="(l, k) in LAYOUTS" :key="k" class="theme-card" :class="{ active: appearance.prefs.layout === k }" @click="appearance.prefs.layout = k">
                <div class="theme-card__preview layout-prev" :class="k">
                  <div class="lp-nav"><i></i><i></i><i></i><i></i></div>
                  <div class="lp-body"><span></span><span></span><span></span></div>
                </div>
                <div class="theme-card__meta">
                  <b>{{ l.name }}</b><small>{{ l.desc }}</small>
                  <Icon v-if="appearance.prefs.layout === k" name="fa-circle-check" :size="18" class="theme-card__check" />
                </div>
              </button>
            </div>
          </section>

          <section class="card mt-16">
            <div class="card__header"><h3>Hiệu ứng chuyển động</h3><span class="muted">Chuyển trang, bấm nút, số liệu</span></div>
            <div class="card__body motion-list">
              <button v-for="(m, k) in MOTIONS" :key="k" class="motion-opt" :class="{ active: appearance.prefs.motion === k }" @click="appearance.prefs.motion = k">
                <span class="motion-opt__demo" :class="k"><i></i></span>
                <span class="motion-opt__text"><b>{{ m.name }}</b><small>{{ m.desc }}</small></span>
                <Icon v-if="appearance.prefs.motion === k" name="fa-circle-check" :size="18" class="motion-opt__check" />
              </button>
            </div>
          </section>
        </template>

        <!-- ============ CỬA HÀNG ============ -->
        <template v-else-if="tab === 'shop'">
        <section class="card">
          <div class="card__header"><h3>Thông tin in trên hoá đơn</h3></div>
          <form class="card__body form-grid" @submit.prevent="saveShop">
            <div class="field full"><label>Tên cửa hàng</label><input class="input" v-model="shop.name" /></div>
            <div class="field"><label>Địa chỉ</label><input class="input" v-model="shop.address" /></div>
            <div class="field"><label>Điện thoại</label><input class="input" v-model="shop.phone" /></div>
            <div class="field full"><label>Lời chào cuối hoá đơn</label><input class="input" v-model="shop.footer" /></div>
            <div class="full"><button class="btn btn--primary"><Icon name="check" :size="15" />Lưu thay đổi</button></div>
          </form>
        </section>
        <PrinterSettings />
        </template>

        <!-- ============ NGƯỜI DÙNG ============ -->
        <section v-else-if="tab === 'users'" class="card">
          <div class="card__header">
            <h3>Người dùng ({{ auth.users.length }})</h3><div class="spacer"></div>
            <button class="btn btn--primary btn--sm" @click="openUser()"><Icon name="fa-user-plus" :size="14" />Thêm người dùng</button>
          </div>
          <div class="table-wrap">
            <table class="table table--cards">
              <thead><tr><th>Người dùng</th><th>Vai trò</th><th>Điện thoại</th><th>Ngày tạo</th><th>Trạng thái</th><th></th></tr></thead>
              <tbody>
                <tr v-for="u in auth.users" :key="u.id" :class="{ 'is-off': u.active === false }">
                  <td class="c-title">
                    <div class="flex">
                      <span class="avatar" :style="{ background: auth.roleById(u.roleId)?.color }">{{ initials(u.name) }}</span>
                      <div>
                        <b>{{ u.name }}</b><span v-if="u.id === auth.user?.id" class="muted"> (bạn)</span>
                        <div v-if="emailMode" class="u-email">
                          <template v-if="u.email">
                            <Icon name="fa-envelope" :size="11" /> {{ u.email }}
                            <span v-if="memberOf(u)?.status === 'member'" class="badge badge--success">Đã tham gia</span>
                            <button v-else-if="memberOf(u)?.status === 'invited'" class="badge badge--warning u-email__link" @click="showInvite(u)">Chờ nhận lời mời · Link mời</button>
                          </template>
                          <span v-else-if="u.roleId === 'owner'" class="muted">Chủ quán · dùng tài khoản email của quán</span>
                          <span v-else class="muted">Chỉ vào ca bằng PIN trên máy quán</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td class="c-sub"><span class="badge badge--plain" :style="{ color: auth.roleById(u.roleId)?.color }">{{ auth.roleById(u.roleId)?.name }}</span></td>
                  <td class="text-2 c-hide">{{ u.phone || '—' }}</td>
                  <td class="text-2 num c-hide">{{ fmtDate(u.createdAt) }}</td>
                  <td class="c-hide"><span class="badge" :class="u.active === false ? '' : 'badge--success'">{{ u.active === false ? 'Đã khoá' : 'Hoạt động' }}</span></td>
                  <td class="text-right c-end" style="white-space: nowrap">
                    <button class="btn btn--ghost btn--sm" @click="openUser(u)">Sửa</button>
                    <button class="btn btn--sm" :class="u.active === false ? 'btn--soft' : 'btn--danger'" @click="toggleUser(u)">{{ u.active === false ? 'Mở' : 'Khoá' }}</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- ============ PHÂN QUYỀN ============ -->
        <section v-else-if="tab === 'roles'" class="roles">
          <div class="card roles__list">
            <div class="card__header"><h3>Vai trò</h3></div>
            <button v-for="r in auth.roles" :key="r.id" class="role-item" :class="{ active: roleId === r.id }" @click="roleId = r.id">
              <span class="role-item__dot" :style="{ background: r.color }"></span>
              <span>{{ r.name }}</span>
              <small class="muted">{{ usersInRole(r.id) }} người</small>
            </button>
            <div class="roles__add">
              <input v-if="newRole !== null" class="input input--sm" v-model="newRole" placeholder="Tên vai trò…" @keyup.enter="addRole" autofocus />
              <button class="btn btn--plain btn--sm" @click="newRole === null ? (newRole = '') : addRole()"><Icon name="plus" :size="13" />{{ newRole === null ? 'Thêm vai trò' : 'Lưu' }}</button>
            </div>
          </div>

          <div class="card roles__perm" v-if="editRole">
            <div class="card__header">
              <h3>Quyền của {{ editRole.name }}</h3>
              <div class="spacer"></div>
              <button v-if="!editRole.system" class="btn btn--danger btn--sm" @click="removeRole">Xoá vai trò</button>
            </div>
            <div class="card__body">
              <div v-if="editRole.id === 'owner'" class="notice"><Icon name="fa-circle-info" :size="15" /> Chủ quán luôn có toàn quyền và không thể chỉnh.</div>
              <div class="discount-row">
                <div><b>Giảm giá tối đa không cần duyệt</b><p class="muted">Vượt mức này, quản lý phải nhập PIN để duyệt</p></div>
                <div class="flex"><input class="input num" type="number" min="0" max="100" :value="editRole.maxDiscount" :disabled="editRole.id === 'owner'" @change="setDiscount($event.target.value)" style="width: 80px; text-align: right" /> %</div>
              </div>
              <div v-for="g in PERMISSION_GROUPS" :key="g.group" class="perm-group">
                <h4>{{ g.group }}</h4>
                <label v-for="[k, label] in g.items" :key="k" class="switch-row" :class="{ disabled: editRole.id === 'owner' }">
                  <span>{{ label }}</span>
                  <input type="checkbox" class="switch" :checked="editRole.permissions.includes(k)" :disabled="editRole.id === 'owner'" @change="togglePerm(k)" />
                </label>
              </div>
            </div>
          </div>
        </section>

        <!-- ============ VẬN HÀNH ============ -->
        <PaymentSettings v-else-if="tab === 'payment'" />
        <EinvoiceSettings v-else-if="tab === 'einvoice'" />
        <ChannelSettings v-else-if="tab === 'channels'" />
        <ServerSettings v-else-if="tab === 'server'" />

        <section v-else-if="tab === 'ops'" class="card">
          <div class="card__header"><h3>Quy tắc vận hành</h3></div>
          <div class="card__body">
            <label class="switch-row big">
              <span><b>Bắt buộc mở ca trước khi bán</b><small>Không có ca đang mở thì không tạo được hoá đơn hay thu tiền phòng. Giúp đối soát két chính xác.</small></span>
              <input type="checkbox" class="switch" v-model="settings.ops.requireShift" />
            </label>
            <div class="switch-row big">
              <span><b>Tự khoá màn hình</b><small>Khoá sau một khoảng thời gian không thao tác, nhân viên nhập PIN để mở lại.</small></span>
              <AppSelect v-model="settings.ops.autoLockMin" :options="[{ value: 0, label: 'Tắt' }, { value: 2, label: '2 phút' }, { value: 5, label: '5 phút' }, { value: 10, label: '10 phút' }, { value: 30, label: '30 phút' }]" style="width: 130px" />
            </div>
            <div class="ops-note">
              <Icon name="fa-user-shield" :size="18" />
              <div>
                <b>Những thao tác luôn cần người có quyền duyệt</b>
                <ul>
                  <li>Huỷ hoá đơn (quyền "Huỷ hoá đơn")</li>
                  <li>Giảm giá vượt mức tối đa của vai trò (chỉnh ở tab Phân quyền)</li>
                  <li>Huỷ đặt phòng đã đặt cọc — phải hoàn tiền (quyền "Huỷ hoá đơn")</li>
                  <li>Xoá dữ liệu cửa hàng</li>
                </ul>
                <small class="muted">Mọi lần duyệt đều được ghi vào Nhật ký thao tác kèm tên người duyệt.</small>
              </div>
            </div>
          </div>
        </section>

        <!-- ============ DỮ LIỆU ============ -->
        <section v-else-if="tab === 'data'" class="card">
          <div class="card__header"><h3>Dữ liệu</h3></div>
          <div class="card__body settings-data">
            <p class="text-2">{{ isLegacy ? 'Dữ liệu đang lưu trong trình duyệt của máy này. Hãy sao lưu định kỳ.' : 'Dữ liệu của quán lưu trên máy chủ và đồng bộ giữa các máy. Vẫn nên sao lưu định kỳ.' }}</p>
            <div class="flex" style="flex-wrap: wrap">
              <button class="btn btn--ghost" @click="backup"><Icon name="download" :size="15" />Sao lưu (JSON)</button>
              <button class="btn btn--ghost" @click="fileEl.click()"><Icon name="upload" :size="15" />Khôi phục từ file</button>
              <input ref="fileEl" type="file" accept=".json" hidden @change="restore" />
            </div>
            <hr />
            <div class="flex" style="flex-wrap: wrap">
              <button v-if="isLegacy" class="btn btn--soft" @click="wipe(true)"><Icon name="sparkle" :size="15" />Nạp dữ liệu mẫu</button>
              <button v-if="!isLegacy && /dreamers/i.test(settings.shop.name || '')" class="btn btn--soft" @click="loadDreamers"><Icon name="fa-mug-saucer" :size="15" />Nạp menu & 7 phòng Dreamers</button>
              <button class="btn btn--danger" @click="wipe(false)"><Icon name="trash" :size="15" />Xoá dữ liệu, bắt đầu dùng thật</button>
            </div>
            <p class="muted" style="margin-top: 10px; font-size: 13px">"Bắt đầu dùng thật" giữ lại người dùng, phân quyền, giao diện và thông tin cửa hàng.</p>
          </div>
        </section>
      </div>
    </div>

    <!-- Gửi link mời -->
    <BaseModal v-if="invite" :title="`Gửi lời mời cho ${invite.name}`" width="480px" @close="invite = null">
      <p style="margin-top: 0">Gửi link này cho <b>{{ invite.name }}</b> qua Zalo hoặc tin nhắn. Mở link, <b>đăng ký hoặc đăng nhập bằng {{ invite.email }}</b> là vào được quán với đúng quyền đã đặt.</p>
      <div class="invite-link"><input class="input" :value="invite.link" readonly @focus="$event.target.select()" /></div>
      <p class="muted" style="font-size: 13px">Link chỉ dùng được 1 lần và chỉ với email trên. Người khác có link nhưng sai email cũng không vào được. Muốn huỷ: khoá người dùng hoặc xoá email.</p>
      <template #footer>
        <button class="btn btn--ghost" @click="invite = null">Đóng</button>
        <button v-if="canShare" class="btn btn--ghost" @click="shareInvite"><Icon name="fa-share-nodes" :size="15" />Chia sẻ</button>
        <button class="btn btn--primary" @click="copyInvite"><Icon name="fa-copy" :size="15" />Sao chép link</button>
      </template>
    </BaseModal>

    <!-- Form người dùng -->
    <BaseModal v-if="userForm" :title="userForm.id ? `Sửa ${userForm.name}` : 'Thêm người dùng'" width="460px" @close="userForm = null">
      <form id="uform" class="form-grid" @submit.prevent="saveUser">
        <div class="field full"><label>Tên hiển thị *</label><input class="input" v-model="userForm.name" autofocus /></div>
        <div class="field"><label>Vai trò</label><AppSelect v-model="userForm.roleId" :options="roleOptions" /></div>
        <div class="field"><label>Điện thoại</label><input class="input" v-model="userForm.phone" /></div>
        <div v-if="emailMode" class="field full">
          <label>Email đăng nhập <span class="muted">· không bắt buộc</span></label>
          <input class="input" v-model="userForm.email" type="email" inputmode="email" autocapitalize="off" placeholder="Để người này tự dùng app trên điện thoại của họ" />
          <small class="muted">Có email: app tạo link mời để gửi qua Zalo / tin nhắn. Để trống: chỉ vào ca bằng PIN trên máy của quán.</small>
        </div>
        <div class="field full">
          <label>{{ userForm.id ? 'Đổi mã PIN (để trống nếu giữ nguyên)' : 'Mã PIN 6 số *' }}</label>
          <input class="input num pin-input" v-model="userForm.pin" inputmode="numeric" maxlength="6" placeholder="••••••" />
        </div>
      </form>
      <template #footer>
        <button class="btn btn--ghost" @click="userForm = null">Huỷ</button>
        <button class="btn btn--primary" type="submit" form="uform">Lưu</button>
      </template>
    </BaseModal>
  </div>
</template>

<style lang="scss">
@use '../styles/tokens' as *;
.settings__layout { display: grid; grid-template-columns: 200px 1fr; gap: 20px; align-items: start; }
.settings__tabs {
  position: sticky; top: calc(#{$topbar-h} + 8px); display: flex; flex-direction: column; gap: 2px;
  button {
    display: flex; align-items: center; gap: 10px; height: 36px; padding: 0 12px; border: 0; border-radius: 9px; background: transparent;
    font: inherit; font-size: 14px; color: $text; cursor: pointer; text-align: left;
    .icon { color: $primary; width: 18px; }
    &:hover { background: $fill; }
    &.active { background: tint($primary, .13); color: $primary; font-weight: 600; }
  }
}
.settings__body { min-width: 0; }
.settings-data { p { margin: 0 0 14px; } hr { border: 0; border-top: 1px solid $border; margin: 18px 0; } }

// Thẻ chọn theme / kiểu menu
.theme-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 14px; }
.theme-card {
  padding: 0; border: 0; border-radius: 16px; overflow: hidden; cursor: pointer; text-align: left; font: inherit; color: $text;
  background: $surface; box-shadow: 0 0 0 1px $border-strong; transition: box-shadow .2s, transform .2s $spring;
  &:hover { transform: translateY(-2px); }
  &.active { box-shadow: 0 0 0 2px $primary, $shadow; }
  &__preview { height: 110px; display: flex; gap: 8px; padding: 10px; }
  &__meta { position: relative; padding: 10px 14px 12px; display: flex; flex-direction: column; b { font-size: 14px; } small { color: $text-muted; font-size: 12px; } }
  &__check { position: absolute; right: 12px; top: 12px; color: $primary; }
}
.tp-side { width: 30%; border-radius: 8px; padding: 8px 6px; display: flex; flex-direction: column; gap: 5px; i { height: 6px; border-radius: 3px; background: rgba(128, 128, 128, .25); } i:first-child { width: 70%; } }
.tp-main { flex: 1; display: flex; flex-direction: column; gap: 8px; }
.tp-card { flex: 1; border-radius: 8px; padding: 8px; box-shadow: 0 1px 2px rgba(0,0,0,.08); i { display: block; width: 40%; height: 8px; border-radius: 4px; } }
.layout-prev {
  background: $surface-2; flex-direction: row;
  .lp-nav { display: flex; flex-direction: column; gap: 6px; width: 28%; padding: 8px 6px; border-radius: 8px; background: $fill-2; i { height: 6px; border-radius: 3px; background: $text-muted; opacity: .5; } i:first-child { background: $primary; opacity: 1; } }
  .lp-body { flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 6px; span { border-radius: 6px; background: $surface; box-shadow: 0 1px 2px rgba(0,0,0,.06); } span:first-child { grid-column: 1 / -1; } }
  &.horizontal { flex-direction: column; .lp-nav { width: 100%; height: 22px; flex-direction: row; align-items: center; i { width: 18%; } } }
}

// Phân quyền
.roles { display: grid; grid-template-columns: 240px 1fr; gap: 16px; align-items: start; }
.roles__list { padding-bottom: 8px; }
.role-item {
  display: flex; align-items: center; gap: 10px; width: calc(100% - 16px); margin: 2px 8px; height: 38px; padding: 0 10px; border: 0; border-radius: 9px;
  background: transparent; font: inherit; color: $text; cursor: pointer; text-align: left;
  small { margin-left: auto; }
  &:hover { background: $fill; }
  &.active { background: tint($primary, .13); font-weight: 600; }
  &__dot { width: 10px; height: 10px; border-radius: 50%; }
}
.roles__add { display: flex; gap: 6px; padding: 8px 12px 4px; .input { flex: 1; } }
.discount-row { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 12px 14px; border-radius: 14px; background: $surface-2; margin-bottom: 8px; p { margin: 2px 0 0; font-size: 13px; } }
.perm-group { margin-top: 18px; h4 { font-size: 12px; color: $text-muted; font-weight: 600; margin: 0 0 4px; } }
.switch-row {
  display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 10px 0; border-bottom: 1px solid $border; cursor: pointer;
  &.disabled { opacity: .6; cursor: default; }
  &.big { padding: 16px 0; span { display: flex; flex-direction: column; gap: 2px; } small { color: $text-muted; font-size: 13px; max-width: 520px; } }
}
// Công tắc kiểu iOS
.switch {
  appearance: none; -webkit-appearance: none; flex-shrink: 0; width: 44px !important; height: 26px !important; border-radius: 999px; margin: 0;
  background: $fill-2; position: relative; cursor: pointer; transition: background .25s $ease;
  &::after { content: ''; position: absolute; top: 2px; left: 2px; width: 22px; height: 22px; border-radius: 50%; background: #fff; box-shadow: 0 2px 4px rgba(0,0,0,.2); transition: transform .25s $spring; }
  &:checked { background: $success; &::after { transform: translateX(18px); } }
  &:disabled { cursor: default; }
}
.ops-note {
  display: flex; gap: 14px; margin-top: 18px; padding: 14px 16px; border-radius: 14px; background: $primary-soft; color: $primary;
  b { color: $text; } ul { margin: 6px 0; padding-left: 18px; color: $text-2; } li { margin: 2px 0; }
}
.notice { display: flex; gap: 8px; align-items: center; padding: 10px 12px; border-radius: 12px; background: $info-soft; color: $info; margin-bottom: 12px; }
tr.is-off { opacity: .55; }

// Chọn mức hiệu ứng, có ô xem trước chuyển động
.motion-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
.motion-opt {
  position: relative; display: flex; align-items: center; gap: 12px; padding: 14px; border: 0; border-radius: 14px; cursor: pointer; text-align: left;
  font: inherit; color: $text; background: $surface; box-shadow: 0 0 0 1px $border-strong; transition: box-shadow .2s;
  &.active { box-shadow: 0 0 0 2px $primary; }
  &__text { display: flex; flex-direction: column; min-width: 0; small { color: $text-muted; font-size: 12px; } }
  &__check { position: absolute; top: 10px; right: 10px; color: $primary; }
  &__demo {
    width: 44px; height: 44px; border-radius: 12px; background: $fill; flex-shrink: 0; position: relative; overflow: hidden;
    i { position: absolute; inset: 10px; border-radius: 6px; background: $primary; }
    &.full i { animation: demoFull 1.8s $spring infinite; }
    &.reduced i { animation: demoFade 1.8s ease-in-out infinite; }
    &.off i { opacity: .5; }
  }
}
@keyframes demoFull { 0%, 20% { transform: translateX(-30px); opacity: 0; } 45%, 80% { transform: none; opacity: 1; } 100% { transform: translateX(30px); opacity: 0; } }
@keyframes demoFade { 0%, 15% { opacity: 0; } 45%, 75% { opacity: 1; } 100% { opacity: 0; } }
[data-motion='off'] .motion-opt__demo i { animation: none !important; }
.pin-input { letter-spacing: .5em; font-size: 18px; }

@include tablet {
  .settings__layout { grid-template-columns: 1fr; }
  .settings__tabs { position: static; flex-direction: row; overflow-x: auto; button { flex-shrink: 0; } }
  .roles { grid-template-columns: 1fr; }
}
.u-email { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin-top: 2px; font-size: 12px; color: var(--text-2);
  .badge { font-size: 11px; } }
.u-email__link { border: 0; cursor: pointer; font: inherit; font-size: 11px; }
.invite-link .input { font-size: 13px; }
</style>
