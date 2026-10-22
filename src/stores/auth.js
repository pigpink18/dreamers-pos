/**
 * NGƯỜI DÙNG • VAI TRÒ • PHÂN QUYỀN • PHIÊN ĐĂNG NHẬP
 *
 * - Đăng nhập bằng mã PIN 6 số (kiểu máy POS ở quầy).
 * - Mỗi người có 1 vai trò; mỗi vai trò là 1 danh sách quyền (chủ quán chỉnh được).
 * - Lưu ý: dữ liệu đang nằm trong trình duyệt, PIN chỉ được băm đơn giản.
 *   Khi có backend thật, phần xác thực phải chuyển lên server.
 */
import { defineStore } from 'pinia'
import { nsKey } from '../tenant'
import { computed, ref } from 'vue'
import { useStorage } from '../utils/storage'
import { uid } from '../utils/format'
import { useAudit } from './audit'

// ---------------- Danh sách quyền ----------------
export const PERMISSION_GROUPS = [
  { group: 'Bán hàng', items: [
    ['pos.sell', 'Bán hàng (POS)'],
    ['pos.discount', 'Giảm giá trên hoá đơn'],
  ] },
  { group: 'Hoá đơn', items: [
    ['invoices.view', 'Xem hoá đơn'],
    ['invoices.cancel', 'Huỷ hoá đơn'],
  ] },
  { group: 'Homestay', items: [
    ['rooms.view', 'Xem sơ đồ & lịch phòng'],
    ['rooms.book', 'Đặt / sửa / huỷ đặt phòng'],
    ['rooms.checkin', 'Nhận phòng & trả phòng'],
    ['rooms.clean', 'Cập nhật dọn phòng'],
    ['rooms.manage', 'Thêm / sửa phòng & giá phòng'],
  ] },
  { group: 'Hàng hoá & khách', items: [
    ['products.view', 'Xem hàng hoá & tồn kho'],
    ['products.manage', 'Thêm / sửa hàng hoá & giá bán'],
    ['products.import', 'Nhập kho'],
    ['customers.view', 'Xem khách hàng'],
    ['customers.manage', 'Thêm / sửa / xoá khách hàng'],
  ] },
  { group: 'Báo cáo', items: [
    ['dashboard.view', 'Xem tổng quan'],
    ['reports.view', 'Xem báo cáo doanh thu & lợi nhuận'],
  ] },
  { group: 'Vận hành', items: [
    ['shifts.open', 'Mở / đóng ca'],
    ['shifts.viewAll', 'Xem ca của mọi người'],
    ['audit.view', 'Xem nhật ký thao tác'],
  ] },
  { group: 'Quản trị', items: [
    ['users.manage', 'Quản lý người dùng'],
    ['roles.manage', 'Phân quyền vai trò'],
    ['settings.manage', 'Cài đặt cửa hàng, vận hành & dữ liệu'],
  ] },
]
export const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap((g) => g.items.map(([k]) => k))
export const PERMISSION_LABEL = Object.fromEntries(PERMISSION_GROUPS.flatMap((g) => g.items))

// ---------------- Vai trò mặc định ----------------
const P = (...keys) => keys
export const DEFAULT_ROLES = [
  { id: 'owner', name: 'Chủ quán', color: '#7b4a26', maxDiscount: 100, system: true, permissions: ALL_PERMISSIONS },
  { id: 'manager', name: 'Quản lý', color: '#2f6db3', maxDiscount: 50, system: true,
    permissions: ALL_PERMISSIONS.filter((p) => p !== 'roles.manage') },
  { id: 'staff', name: 'Nhân viên', color: '#2f7d45', maxDiscount: 10, system: true,
    permissions: P('dashboard.view', 'pos.sell', 'pos.discount', 'invoices.view', 'products.view', 'rooms.view', 'rooms.book', 'rooms.checkin', 'rooms.clean', 'customers.view', 'customers.manage', 'shifts.open') },
  { id: 'cashier', name: 'Thu ngân', color: '#2f7d45', maxDiscount: 10, system: true,
    permissions: P('dashboard.view', 'pos.sell', 'pos.discount', 'invoices.view', 'customers.view', 'customers.manage', 'products.view', 'rooms.view', 'shifts.open') },
  { id: 'reception', name: 'Lễ tân', color: '#b45309', maxDiscount: 10, system: true,
    permissions: P('dashboard.view', 'pos.sell', 'pos.discount', 'invoices.view', 'rooms.view', 'rooms.book', 'rooms.checkin', 'rooms.clean', 'customers.view', 'customers.manage', 'shifts.open') },
  { id: 'housekeeping', name: 'Buồng phòng', color: '#6b5b95', maxDiscount: 0, system: true,
    permissions: P('rooms.view', 'rooms.clean') },
]

/** Băm PIN (không phải bảo mật cấp ngân hàng — chỉ để PIN không nằm trần trong localStorage) */
export function hashPin(pin, salt = 'dreamers') {
  let h1 = 0x811c9dc5, h2 = 0x01000193
  const s = salt + ':' + pin
  for (let r = 0; r < 500; r++)
    for (let i = 0; i < s.length; i++) {
      h1 = Math.imul(h1 ^ s.charCodeAt(i), 16777619) >>> 0
      h2 = Math.imul(h2 ^ (h1 >>> 7) ^ r, 2246822519) >>> 0
    }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')
}
export const initials = (name = '') => name.trim().split(/\s+/).slice(-2).map((w) => w[0]).join('').toUpperCase()

export const useAuth = defineStore('auth', () => {
  /** { id, name, username, roleId, pinHash, active, createdAt, phone } */
  const users = useStorage('users', [])
  const roles = useStorage('roles', DEFAULT_ROLES.map((r) => ({ ...r, permissions: [...r.permissions] })))
  /** Phiên hiện tại: { userId, locked, since } */
  const session = useStorage('session', null)

  const user = computed(() => (session.value ? users.value.find((u) => u.id === session.value.userId && u.active !== false) : null))
  const role = computed(() => roleById(user.value?.roleId))
  const isLocked = computed(() => !!session.value?.locked)
  const isAuthenticated = computed(() => !!user.value && !isLocked.value)
  const activeUsers = computed(() => users.value.filter((u) => u.active !== false))

  const roleById = (id) => roles.value.find((r) => r.id === id)
  const userById = (id) => users.value.find((u) => u.id === id)
  const userCan = (u, perm) => !!u && (roleById(u.roleId)?.permissions || []).includes(perm)
  /** Người đang đăng nhập có quyền này không? */
  const can = (perm) => userCan(user.value, perm)
  const maxDiscount = computed(() => role.value?.maxDiscount ?? 0)

  // ---------- Chống dò PIN: sai 5 lần -> khoá tạm 30 giây, càng sai càng khoá lâu (tối đa 15 phút) ----------
  const GUARD = nsKey('pinGuard')
  const readGuard = () => { try { return JSON.parse(localStorage.getItem(GUARD)) || { fails: 0, until: 0 } } catch { return { fails: 0, until: 0 } } }
  const pinGuard = ref(readGuard())
  /** Số giây còn phải chờ trước khi được nhập PIN tiếp (0 = nhập được) */
  const pinWait = () => Math.max(0, Math.ceil((pinGuard.value.until - Date.now()) / 1000))
  function pinFailed(who) {
    const g = { ...pinGuard.value, fails: pinGuard.value.fails + 1 }
    if (g.fails >= 5) {
      const secs = Math.min(900, 30 * 2 ** Math.floor((g.fails - 5) / 5))
      g.until = Date.now() + secs * 1000
      useAudit().log('login.fail', `Nhập sai PIN ${g.fails} lần liên tiếp (${who}) — khoá nhập PIN ${secs} giây`)
    }
    pinGuard.value = g
    localStorage.setItem(GUARD, JSON.stringify(g))
  }
  function pinOk() {
    if (!pinGuard.value.fails) return
    pinGuard.value = { fails: 0, until: 0 }
    localStorage.removeItem(GUARD)
  }

  // ---------- Đăng nhập / khoá / đăng xuất ----------
  function login(userId, pin) {
    if (pinWait()) return false
    const u = userById(userId)
    if (!u || u.active === false || u.pinHash !== hashPin(pin)) {
      useAudit().log('login.fail', `Nhập sai PIN: ${u?.name || '?'}`, { user: u })
      pinFailed(u?.name || '?')
      return false
    }
    pinOk()
    const switching = session.value && session.value.userId !== u.id
    session.value = { userId: u.id, locked: false, since: new Date().toISOString() }
    useAudit().log(switching ? 'login.switch' : 'login', `${u.name} đăng nhập`)
    return true
  }
  function lock() {
    if (!session.value) return
    session.value.locked = true
    useAudit().log('lock', 'Khoá màn hình')
  }
  function logout() {
    useAudit().log('logout', `${user.value?.name || ''} đăng xuất`)
    session.value = null
  }

  /** Tìm người có PIN này và (tuỳ chọn) thoả điều kiện — dùng cho "quản lý duyệt" */
  function findByPin(pin, check = () => true, { guard = false } = {}) {
    if (guard && pinWait()) return null
    const h = hashPin(pin)
    const u = activeUsers.value.find((x) => x.pinHash === h && check(x)) || null
    if (guard) { if (activeUsers.value.some((x) => x.pinHash === h)) pinOk(); else pinFailed('duyệt thao tác') }
    return u
  }

  // ---------- Quản lý người dùng ----------
  function pinTaken(pin, exceptId) {
    const h = hashPin(pin)
    return users.value.some((u) => u.pinHash === h && u.id !== exceptId && u.active !== false)
  }
  function saveUser(data) {
    const { pin, ...rest } = data
    if (pin && pinTaken(pin, data.id)) throw new Error('Mã PIN này không dùng được, hãy chọn mã khác')
    if (data.id) {
      const u = userById(data.id)
      const before = { roleId: u.roleId, active: u.active }
      const snapshot = { ...u }
      Object.assign(u, rest)
      if (pin) u.pinHash = hashPin(pin)
      // không được hạ / khoá chủ quán cuối cùng -> trả lại như cũ
      try { ensureOwner() } catch (e) { Object.keys(u).forEach((k) => delete u[k]); Object.assign(u, snapshot); throw e }
      useAudit().log('user.update', `Sửa người dùng ${u.name}` + (before.roleId !== u.roleId ? ` (vai trò: ${roleById(before.roleId)?.name} → ${roleById(u.roleId)?.name})` : '') + (pin ? ' · đổi PIN' : ''))
      return u
    }
    if (!pin) throw new Error('Cần đặt mã PIN cho người dùng mới')
    const u = { active: true, ...rest, id: uid(), pinHash: hashPin(pin), createdAt: new Date().toISOString() }
    users.value.push(u)
    useAudit().log('user.create', `Thêm người dùng ${u.name} (${roleById(u.roleId)?.name})`)
    return u
  }
  /** Luôn phải còn ít nhất 1 chủ quán đang hoạt động */
  function ensureOwner() {
    const owners = users.value.filter((u) => u.roleId === 'owner' && u.active !== false)
    if (!owners.length) throw new Error('Phải còn ít nhất một tài khoản Chủ quán đang hoạt động')
  }
  function setActive(id, active) {
    const u = userById(id)
    const prev = u.active
    u.active = active
    try { ensureOwner() } catch (e) { u.active = prev; throw e }
    useAudit().log(active ? 'user.enable' : 'user.disable', `${active ? 'Mở khoá' : 'Khoá'} tài khoản ${u.name}`)
  }

  // ---------- Vai trò ----------
  function saveRole(data) {
    if (data.id === 'owner') throw new Error('Không thể sửa quyền của Chủ quán')
    let r = roleById(data.id)
    if (r) Object.assign(r, data)
    else roles.value.push((r = { color: '#64748b', maxDiscount: 0, permissions: [], ...data, id: data.id || uid() }))
    useAudit().log('role.update', `Cập nhật vai trò ${r.name}`)
    return r
  }
  function removeRole(id) {
    const r = roleById(id)
    if (r?.system) throw new Error('Không xoá được vai trò mặc định')
    if (users.value.some((u) => u.roleId === id)) throw new Error('Vai trò đang có người dùng, hãy chuyển họ sang vai trò khác trước')
    roles.value = roles.value.filter((x) => x.id !== id)
    useAudit().log('role.delete', `Xoá vai trò ${r?.name}`)
  }

  /** Tạo tài khoản Chủ quán đầu tiên (khi dữ liệu trống) */
  function setupOwner({ name, pin }) {
    const u = { id: uid(), name, roleId: 'owner', pinHash: hashPin(pin), active: true, createdAt: new Date().toISOString() }
    users.value.push(u)
    session.value = { userId: u.id, locked: false, since: new Date().toISOString() }
    useAudit().log('user.create', `Tạo tài khoản Chủ quán ${name}`)
  }

  return {
    users, roles, session, user, role, isLocked, isAuthenticated, activeUsers, maxDiscount,
    roleById, userById, userCan, can, login, lock, logout, findByPin, pinTaken, saveUser, setActive, pinWait,
    saveRole, removeRole, setupOwner,
  }
})
