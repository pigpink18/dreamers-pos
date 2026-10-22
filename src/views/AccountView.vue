<script setup>
/**
 * TÀI KHOẢN CHỦ QUÁN (hệ thống nhiều quán)
 *  - Đăng ký / đăng nhập bằng email + mật khẩu
 *  - Danh sách quán của tài khoản → chọn quán để mở trên máy này
 *  - Tạo quán mới (trống) hoặc đưa dữ liệu đang có trên máy này lên làm 1 quán
 * Mỗi quán có dữ liệu riêng hoàn toàn; nhân viên vào quán bằng PIN như trước.
 */
import { ref, reactive, computed, watch, onMounted } from 'vue'
import Icon from '../components/ui/Icon.vue'
import WelcomeSplash from '../components/account/WelcomeSplash.vue'
import logo from '../assets/image/logo.png'
import { useUi } from '../stores/ui'
import { useAuth, hashPin } from '../stores/auth'
import { useRouter, useRoute } from 'vue-router'
import { LEGACY_SHOP, LEGACY_PAYMENT } from '../stores/settings'
import { boot } from '../boot'
import {
  activeShopId, activeShop, isLegacy, setActiveShop, platformConfigured, hasLegacyData,
  copyLegacyInto, shopPrefix, forgetShopData, LEGACY_PREFIX,
} from '../tenant'

const ui = useUi()
const conn = ref(null) // module sync/connection (tải khi cần)
const loading = ref(true)
const session = ref(null)
const shops = ref([])
const err = ref('')
const busy = ref(false)

const configured = ref(platformConfigured())
const server = reactive({ url: '', key: '' })

const mode = ref('signin') // signin | signup
const cred = reactive({ email: '', password: '', password2: '' })

const creating = ref(false)
// ---- Link mời: #/account?invite=<mã> -> giữ lại tới khi đăng nhập / đăng ký xong thì nhận lời mời ----
const INVITE = 'dreamers:invite'
const route = useRoute()
if (route.query.invite) { try { sessionStorage.setItem(INVITE, String(route.query.invite)) } catch { /* bỏ qua */ } }
const pendingInvite = ref((() => { try { return sessionStorage.getItem(INVITE) } catch { return null } })())
const role = ref(null) // vai trò trên máy chủ ở quán đang mở
async function takeInvite() {
  if (!pendingInvite.value || !session.value) return null
  try {
    const shopId = await conn.value.acceptInvite(pendingInvite.value)
    ui.toast('Đã nhận lời mời vào quán')
    return shopId
  } catch (e) {
    ui.toast(e.message, 'error')
    return null
  } finally {
    pendingInvite.value = null
    try { sessionStorage.removeItem(INVITE) } catch { /* bỏ qua */ }
  }
}
const IMPORTED = LEGACY_PREFIX + 'importedTo'
const legacyAvailable = computed(() => hasLegacyData() && !localStorage.getItem(IMPORTED))
const form = reactive({ name: '', address: '', phone: '', ownerName: '', pin: '', pin2: '', source: 'blank', legacyPin: '' })
// Quán tên "Dreamers…": cho chọn menu + 7 phòng Dreamers có sẵn trong app (dù máy này không có dữ liệu cũ)
const isDreamersName = computed(() => /dreamers/i.test(form.name))
watch(isDreamersName, (v) => {
  if (v && form.source === 'blank') form.source = 'dreamers'
  if (!v && form.source === 'dreamers') form.source = 'blank'
})
// Tóm tắt dữ liệu đang có trên máy (để chủ quán biết sẽ đưa gì lên)
const legacySummary = computed(() => {
  const n = (k) => { try { const v = JSON.parse(localStorage.getItem(LEGACY_PREFIX + k)); return Array.isArray(v) ? v.length : 0 } catch { return 0 } }
  let name = LEGACY_SHOP.name
  try { name = JSON.parse(localStorage.getItem(LEGACY_PREFIX + 'shop'))?.name || name } catch { /* bỏ qua */ }
  return { name, products: n('products'), rooms: n('rooms'), invoices: n('invoices'), users: n('users') }
})

async function load() {
  loading.value = true
  err.value = ''
  try {
    if (!configured.value) return
    conn.value = await import('../sync/connection')
    session.value = await conn.value.getSession()
    const invitedShop = await takeInvite()
    // không để vòng quay chờ mãi khi mất mạng
    if (session.value) shops.value = await Promise.race([conn.value.listShops(), new Promise((_, rej) => setTimeout(() => rej(new Error('Không kết nối được máy chủ — kiểm tra mạng')), 12000))])
    // máy đang mở 1 quán và tài khoản vẫn còn quyền -> cập nhật tên quán đang lưu
    const cur = shops.value.find((s) => s.id === activeShopId)
    if (cur && cur.name !== activeShop?.name) setActiveShop(cur)
    if (cur) role.value = await conn.value.myRole(cur.id).catch(() => null)
    // vừa nhận lời mời -> mở luôn quán đó
    const inv = invitedShop && shops.value.find((x) => x.id === invitedShop)
    if (inv) return open(inv)
  } catch (e) {
    err.value = e.message || String(e)
  } finally {
    loading.value = false
  }
}
// Máy đang mở quán: nhân viên không được vào trang tài khoản chủ quán (đăng xuất, tạo / đổi quán)
// -> cần PIN của chủ quán hoặc quản lý. Máy chưa mở quán (đăng ký / đăng nhập lần đầu) thì không cần.
const router = useRouter()
onMounted(async () => {
  await load()
  // Chỉ tài khoản chủ quán / quản lý mới cần chặn (đăng xuất, tạo / đổi quán của chủ). Nhân viên đăng nhập
  // bằng email của chính họ thì tự quản lý tài khoản của mình được.
  if (activeShopId && boot.state === 'ready' && session.value && role.value !== 'staff') {
    const auth = useAuth()
    if (auth.activeUsers.length) {
      const ok = await ui.approve({ perm: 'settings.manage', reason: 'Mở trang tài khoản chủ quán' })
      if (!ok) return router.replace('/login')
    }
  }
})

function saveServer() {
  import('../sync/connection').then((m) => {
    try {
      m.setPlatform(server)
      configured.value = true
      ui.toast('Đã lưu máy chủ')
      load()
    } catch (e) { ui.toast(e.message, 'error') }
  })
}

async function submitCred() {
  if (!/^\S+@\S+\.\S+$/.test(cred.email.trim())) return ui.toast('Nhập email hợp lệ', 'error')
  if (mode.value === 'signup') {
    // tài khoản chủ quán giữ cả dữ liệu lẫn quyền đổi tài khoản nhận tiền -> mật khẩu phải đủ mạnh
    if (cred.password.length < 8 || !/[A-Za-z]/.test(cred.password) || !/\d/.test(cred.password))
      return ui.toast('Mật khẩu cần ít nhất 8 ký tự, có cả chữ và số', 'error')
    if (cred.password !== cred.password2) return ui.toast('Hai lần nhập mật khẩu không khớp', 'error')
  } else if (cred.password.length < 6) return ui.toast('Nhập mật khẩu', 'error')
  busy.value = true
  try {
    if (mode.value === 'signin') await conn.value.signIn(cred.email, cred.password)
    else {
      const r = await conn.value.signUp(cred.email, cred.password)
      if (r.needConfirm) {
        ui.toast('Đã gửi email xác nhận — bấm link trong email rồi quay lại đăng nhập')
        mode.value = 'signin'
        return
      }
      ui.toast('Đã tạo tài khoản')
    }
    cred.password = cred.password2 = ''
    // máy đang chờ đăng nhập để tải dữ liệu quán -> tải lại để mở quán
    if (activeShopId && boot.state !== 'ready') return reopen()
    const hadInvite = !!pendingInvite.value
    await load()
    if (!shops.value.length && !hadInvite) creating.value = true
  } catch (e) {
    ui.toast(e.message, 'error')
  } finally {
    busy.value = false
  }
}

/** Mở quán (tải lại app để mọi dữ liệu đọc đúng vùng của quán) */
function open(shop) {
  if (shop.id === activeShopId && boot.state === 'ready') return location.assign(location.pathname + '#/login')
  setActiveShop(shop)
  reopen()
}
function reopen() {
  location.hash = '#/login'
  location.reload()
}

async function createShop() {
  const f = form
  if (!f.name.trim()) return ui.toast('Nhập tên quán', 'error')
  const blank = f.source !== 'legacy'
  // Đưa dữ liệu cũ trên máy lên: phải chứng minh là chủ của dữ liệu đó (PIN chủ quán trong dữ liệu cũ),
  // để người khác cầm máy này tạo tài khoản mới cũng không chép được menu, hoá đơn, nhân viên của quán
  if (!blank) {
    let legacyUsers = []
    try { legacyUsers = JSON.parse(localStorage.getItem(LEGACY_PREFIX + 'users')) || [] } catch { /* bỏ qua */ }
    const h = hashPin(String(f.legacyPin || ''))
    const owner = legacyUsers.find((u) => u.roleId === 'owner' && u.active !== false && u.pinHash === h)
    if (!/^\d{6}$/.test(f.legacyPin || '') || !owner) {
      f.legacyPin = ''
      return ui.toast('Mã PIN chủ quán của dữ liệu này không đúng', 'error')
    }
  }
  if (blank) {
    if (!f.ownerName.trim()) return ui.toast('Nhập tên của bạn (hiện ở màn hình chọn người)', 'error')
    if (!/^\d{6}$/.test(f.pin)) return ui.toast('Mã PIN gồm đúng 6 chữ số', 'error')
    if (f.pin !== f.pin2) return ui.toast('Hai lần nhập PIN không khớp', 'error')
  }
  busy.value = true
  try {
    const shop = await conn.value.createShop(f.name)
    const p = shopPrefix(shop.id)
    if (blank) {
      localStorage.setItem(p + 'init', JSON.stringify({ name: f.name.trim(), address: f.address, phone: f.phone, ownerName: f.ownerName.trim(), pin: f.pin, template: f.source === 'dreamers' ? 'dreamers' : '' }))
    } else {
      // Đưa dữ liệu đang có trên máy này (menu, phòng, hoá đơn, nhân viên…) sang quán mới
      copyLegacyInto(shop.id)
      // Giá trị mặc định chưa từng được lưu trên máy (chưa ai sửa) -> ghi rõ để không bị mất khi sang quán mới
      if (!localStorage.getItem(p + 'payment')) localStorage.setItem(p + 'payment', JSON.stringify(LEGACY_PAYMENT))
      try {
        const info = JSON.parse(localStorage.getItem(p + 'shop')) || { ...LEGACY_SHOP }
        Object.assign(info, { name: f.name.trim() }, f.address ? { address: f.address } : {}, f.phone ? { phone: f.phone } : {})
        localStorage.setItem(p + 'shop', JSON.stringify(info))
      } catch { /* bỏ qua */ }
      localStorage.setItem(p + 'init', JSON.stringify({ importLegacy: true }))
      localStorage.setItem(IMPORTED, shop.id)
    }
    setActiveShop(shop)
    ui.toast(`Đã tạo quán ${shop.name}`)
    reopen()
  } catch (e) {
    ui.toast(e.message, 'error')
  } finally {
    busy.value = false
  }
}

async function logout(everywhere = false) {
  // Còn thay đổi chưa gửi lên máy chủ -> không cho đăng xuất (đăng xuất sẽ xoá dữ liệu quán trên máy này)
  if (activeShopId) {
    const { sync } = await import('../sync/engine')
    const n = sync.pendingCount()
    if (n) return ui.toast(`Còn ${n} thay đổi chưa gửi lên máy chủ — kết nối mạng, chờ đồng bộ xong rồi đăng xuất`, 'error')
  }
  const msg = everywhere
    ? 'Đăng xuất tài khoản trên TẤT CẢ các máy (dùng khi mất điện thoại hoặc nghi lộ mật khẩu)? Mọi máy phải đăng nhập lại. Dữ liệu vẫn còn nguyên trên máy chủ.'
    : 'Đăng xuất tài khoản trên máy này? Dữ liệu các quán sẽ được xoá khỏi máy này (vẫn còn nguyên trên máy chủ, đăng nhập lại là có).'
  if (!(await ui.confirm(msg, { okText: everywhere ? 'Đăng xuất mọi máy' : 'Đăng xuất', danger: true }))) return
  busy.value = true
  await conn.value.signOut(everywhere ? 'global' : 'local')
  shops.value.forEach((s) => forgetShopData(s.id))
  if (activeShopId) forgetShopData(activeShopId)
  setActiveShop(null)
  localStorage.removeItem('dreamers-sb-auth')
  location.hash = '#/account'
  location.reload()
}

// ---- Màn chào: lần đầu mở trang tài khoản trong phiên (khi chưa mở quán), tắt nếu máy / app giảm chuyển động ----
const SPLASH = 'dreamers:splash'
const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'off'
let splashSeen = false
try { splashSeen = sessionStorage.getItem(SPLASH) === '1' } catch { /* bỏ qua */ }
const showSplash = ref(!splashSeen && !reduceMotion && !(activeShopId && boot.state === 'ready'))
const entered = ref(!showSplash.value) // true -> các phần của form trượt lên lần lượt
function splashDone() {
  showSplash.value = false
  try { sessionStorage.setItem(SPLASH, '1') } catch { /* bỏ qua */ }
  entered.value = true
}

const email = computed(() => session.value?.user?.email || '')
const initial = computed(() => (email.value[0] || '?').toUpperCase())
const showPw = ref(false)

// Màn đang hiện + tiêu đề (kiểu trang Apple ID: 1 cột, tiêu đề lớn, ít chữ)
const view = computed(() => {
  if (!configured.value) return 'server'
  if (loading.value) return 'loading'
  if (!session.value) return 'auth'
  return creating.value || !shops.value.length ? 'create' : 'shops'
})
const heading = computed(() => ({
  server: ['Cài máy chủ', 'Nhập địa chỉ và khoá công khai của dự án Supabase.'],
  loading: ['Dreamers POS', ''],
  auth: pendingInvite.value
    ? [mode.value === 'signin' ? 'Đăng nhập' : 'Tạo tài khoản', 'Dùng đúng email đã được mời để vào quán.']
    : mode.value === 'signin'
      ? ['Đăng nhập', 'Dùng tài khoản chủ quán để mở quán trên máy này.']
      : ['Tạo tài khoản', 'Mỗi quán có dữ liệu riêng: menu, phòng, hoá đơn, nhân viên.'],
  shops: ['Chọn quán', 'Chọn quán để mở trên máy này.'],
  create: ['Tạo quán mới', 'Vài thông tin cơ bản, có thể sửa lại trong Cài đặt.'],
})[view.value])
function switchMode() {
  mode.value = mode.value === 'signin' ? 'signup' : 'signin'
  cred.password = cred.password2 = ''
}
</script>

<template>
  <div class="acct">
    <Transition name="splash-out"><WelcomeSplash v-if="showSplash" @done="splashDone" /></Transition>
    <main class="acct__wrap" :class="{ 'is-in': entered }">
      <!-- Biểu tượng app + tiêu đề -->
      <header class="acct__brand">
        <div class="acct__icon"><img :src="logo" alt="Dreamers POS" /></div>
        <p class="acct__eyebrow">Dreamers POS</p>
        <h1>{{ heading[0] }}</h1>
        <p v-if="heading[1]" class="acct__lead">{{ heading[1] }}</p>
      </header>

      <!-- Thông báo trạng thái -->
      <div v-if="boot.state === 'error'" class="acct__note acct__note--warn">
        <Icon name="fa-wifi-slash" :size="16" />
        <span>Không tải được dữ liệu quán {{ activeShop?.name }}: {{ boot.error }}. Lần đầu mở quán trên máy này cần có mạng.</span>
        <button class="acct__link" @click="reopen">Thử lại</button>
      </div>
      <div v-if="pendingInvite && !session" class="acct__note">
        <Icon name="fa-envelope-open-text" :size="16" /><span>Bạn được mời vào một quán. <b>Đăng nhập</b> hoặc <b>đăng ký</b> bằng đúng email đã được mời để vào quán.</span>
      </div>
      <div v-if="view === 'auth' && boot.state === 'needSession'" class="acct__note">
        <Icon name="fa-store" :size="16" /><span>Đăng nhập tài khoản chủ quán để mở <b>{{ activeShop?.name }}</b> trên máy này.</span>
      </div>
      <p v-if="err && view !== 'auth'" class="acct__note acct__note--warn"><Icon name="fa-triangle-exclamation" :size="16" /><span>{{ err }}</span></p>

      <Transition name="acct-step" mode="out-in">
        <!-- Chưa cài máy chủ -->
        <form v-if="view === 'server'" key="server" class="acct__form" @submit.prevent="saveServer">
          <div class="ios-group">
            <label class="ios-field"><span>Project URL</span><input v-model="server.url" name="url" placeholder="https://xxxx.supabase.co" autocomplete="off" /></label>
            <label class="ios-field"><span>Khoá công khai (anon / publishable)</span><input v-model="server.key" name="key" placeholder="sb_publishable_… hoặc eyJ…" autocomplete="off" /></label>
          </div>
          <p class="acct__foot-note">Lấy trong Supabase › Connect. Không dùng khoá service_role / secret.</p>
          <button class="btn btn--primary acct__cta">Lưu máy chủ</button>
        </form>

        <div v-else-if="view === 'loading'" key="loading" class="acct__loading"><span class="spin"></span></div>

        <!-- Đăng nhập / đăng ký -->
        <form v-else-if="view === 'auth'" :key="'auth-' + mode" class="acct__form" @submit.prevent="submitCred" novalidate>
          <div class="ios-group">
            <label class="ios-field">
              <span>Email</span>
              <input v-model="cred.email" name="email" type="email" inputmode="email" autocomplete="email" placeholder="ten@quancuaban.vn" autocapitalize="off" spellcheck="false" />
            </label>
            <label class="ios-field ios-field--pw">
              <span>Mật khẩu</span>
              <input v-model="cred.password" name="password" :type="showPw ? 'text' : 'password'" :autocomplete="mode === 'signin' ? 'current-password' : 'new-password'" :placeholder="mode === 'signup' ? 'Ít nhất 8 ký tự, có chữ và số' : ''" />
              <button type="button" class="ios-field__eye" :aria-label="showPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'" @click="showPw = !showPw"><Icon :name="showPw ? 'fa-eye-slash' : 'fa-eye'" :size="16" /></button>
            </label>
            <label v-if="mode === 'signup'" class="ios-field">
              <span>Nhập lại mật khẩu</span>
              <input v-model="cred.password2" name="password2" :type="showPw ? 'text' : 'password'" autocomplete="new-password" />
            </label>
          </div>
          <button class="btn btn--primary acct__cta" :disabled="busy">
            <span v-if="busy" class="spin spin--light"></span>{{ mode === 'signin' ? 'Đăng nhập' : 'Tạo tài khoản' }}
          </button>
          <p class="acct-switch">
            {{ mode === 'signin' ? 'Chưa có tài khoản?' : 'Đã có tài khoản?' }}
            <button type="button" class="acct__link" @click="switchMode">{{ mode === 'signin' ? (pendingInvite ? 'Đăng ký tài khoản' : 'Đăng ký quán mới') : 'Đăng nhập' }}</button>
          </p>
        </form>

        <!-- Danh sách quán -->
        <section v-else-if="view === 'shops'" key="shops" class="acct__form">
          <div class="ios-group ios-list">
            <button v-for="s in shops" :key="s.id" class="shop-item" :class="{ active: s.id === activeShopId }" @click="open(s)">
              <span class="shop-item__icon">{{ (s.name || '?').trim()[0]?.toUpperCase() }}</span>
              <span class="shop-item__txt"><b>{{ s.name }}</b><small>{{ s.id === activeShopId ? 'Đang mở trên máy này' : 'Mở trên máy này' }}</small></span>
              <Icon v-if="s.id === activeShopId" name="check" :size="16" class="shop-item__check" />
              <Icon name="right" :size="14" class="shop-item__chev" />
            </button>
            <button class="shop-item shop-item--add" @click="creating = true">
              <span class="shop-item__icon"><Icon name="plus" :size="16" /></span>
              <span class="shop-item__txt"><b>Tạo quán mới</b><small>Chi nhánh khác, dữ liệu riêng</small></span>
            </button>
          </div>
        </section>

        <!-- Tạo quán -->
        <form v-else-if="view === 'create'" key="create" class="acct__form" @submit.prevent="createShop" novalidate>
          <button v-if="shops.length" type="button" class="acct__back" @click="creating = false"><Icon name="left" :size="14" />Quán của bạn</button>

          <p class="ios-caption">Thông tin quán</p>
          <div class="ios-group">
            <label class="ios-field"><span>Tên quán</span><input v-model="form.name" name="shopName" placeholder="VD: Mây Coffee & Homestay" /></label>
            <label class="ios-field"><span>Địa chỉ <i>· không bắt buộc</i></span><input v-model="form.address" name="address" /></label>
            <label class="ios-field"><span>Điện thoại <i>· không bắt buộc</i></span><input v-model="form.phone" name="phone" type="tel" inputmode="tel" /></label>
          </div>

          <template v-if="legacyAvailable || isDreamersName">
            <p class="ios-caption">Dữ liệu ban đầu</p>
            <div class="ios-group src-pick" role="radiogroup">
              <button type="button" role="radio" :aria-checked="form.source === 'blank'" :class="{ active: form.source === 'blank' }" @click="form.source = 'blank'">
                <span class="src-pick__radio"></span>
                <span><b>Quán trống</b><small>Tự thêm menu, phòng, nhân viên</small></span>
              </button>
              <button v-if="isDreamersName" type="button" role="radio" :aria-checked="form.source === 'dreamers'" :class="{ active: form.source === 'dreamers' }" @click="form.source = 'dreamers'">
                <span class="src-pick__radio"></span>
                <span><b>Menu & 7 phòng Dreamers</b><small>Có sẵn trong app: toàn bộ món, 7 phòng (Mây, Nắng, Gió…), tài khoản MB nhận chuyển khoản, nhân viên Lam</small></span>
              </button>
              <button v-if="legacyAvailable" type="button" role="radio" :aria-checked="form.source === 'legacy'" :class="{ active: form.source === 'legacy' }" @click="form.source = 'legacy'">
                <span class="src-pick__radio"></span>
                <span>
                  <b>Dữ liệu đang có trên máy này</b>
                  <small>{{ legacySummary.name }} · {{ legacySummary.products }} món · {{ legacySummary.rooms }} phòng · {{ legacySummary.invoices }} hoá đơn · {{ legacySummary.users }} nhân viên</small>
                </span>
              </button>
            </div>
          </template>

          <template v-if="form.source !== 'legacy'">
            <p class="ios-caption">Chủ quán</p>
            <div class="ios-group">
              <label class="ios-field"><span>Tên của bạn</span><input v-model="form.ownerName" name="ownerName" placeholder="Hiện ở màn hình chọn người" /></label>
              <div class="ios-row">
                <label class="ios-field"><span>Mã PIN 6 số</span><input v-model="form.pin" name="pin" class="num" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password" /></label>
                <label class="ios-field"><span>Nhập lại PIN</span><input v-model="form.pin2" name="pin2" class="num" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password" /></label>
              </div>
            </div>
            <p class="acct__foot-note">Mã PIN dùng để vào ca trên máy bán hàng. Nhân viên thêm sau trong Cài đặt › Người dùng.</p>
          </template>
          <template v-else>
            <p class="ios-caption">Xác nhận chủ dữ liệu</p>
            <div class="ios-group">
              <label class="ios-field"><span>Mã PIN chủ quán ({{ legacySummary.name }})</span><input v-model="form.legacyPin" name="legacyPin" class="num" type="password" inputmode="numeric" maxlength="6" autocomplete="off" placeholder="PIN 6 số của chủ quán" /></label>
            </div>
            <p class="acct__foot-note">Chỉ chủ quán của dữ liệu này mới đưa được lên. Nhân viên và mã PIN giữ nguyên như đang dùng.</p>
          </template>

          <button class="btn btn--primary acct__cta" :disabled="busy"><span v-if="busy" class="spin spin--light"></span>Tạo quán & mở</button>
        </form>
      </Transition>

      <!-- Tài khoản đang đăng nhập -->
      <footer v-if="session && view !== 'loading'" class="acct__me">
        <span class="acct__avatar">{{ initial }}</span>
        <span class="acct__email">{{ email }}</span>
        <button v-if="activeShopId && boot.state === 'ready'" class="acct__link" @click="open(activeShop)">Quay lại quán</button>
        <button class="acct__link" :disabled="busy" @click="logout()">Đăng xuất</button>
      </footer>
      <p v-if="session && view !== 'loading'" class="acct__legal">
        <button class="acct__link acct__link--muted" :disabled="busy" @click="logout(true)"><Icon name="fa-right-from-bracket" :size="12" /> Đăng xuất khỏi mọi máy</button>
      </p>
      <p v-else class="acct__legal"><Icon name="fa-lock" :size="12" /> Dữ liệu mỗi quán tách biệt · Nhân viên vào ca bằng mã PIN</p>
    </main>
  </div>
</template>

<style lang="scss">
@use '../styles/tokens' as *;
// Trang tài khoản kiểu Apple ID: nền trơn sáng, 1 cột, tiêu đề lớn, nhóm ô nhập bo tròn
.acct {
  position: fixed; inset: 0; z-index: 1; overflow-y: auto; -webkit-overflow-scrolling: touch;
  display: flex; justify-content: center; align-items: flex-start;
  padding: max(40px, 7vh) 20px calc(32px + var(--safe-bottom));
  // nền hoa văn của app (đặt trên body) vẫn hiện, phủ thêm quầng sáng màu cà phê phía trên
  background: radial-gradient(900px 420px at 50% -120px, color-mix(in srgb, var(--primary) 12%, transparent), transparent 70%);
  color: $text;
  -webkit-font-smoothing: antialiased;
}
.acct__wrap { width: 100%; max-width: 420px; display: flex; flex-direction: column; gap: 18px; }

.acct__brand {
  text-align: center; display: flex; flex-direction: column; align-items: center;
  h1 { margin: 2px 0 0; font: 700 32px/1.12 $font-display; letter-spacing: -0.03em; }
}
.acct__icon {
  width: 76px; height: 76px; border-radius: 19px; background: #fff; display: grid; place-items: center; margin-bottom: 14px;
  box-shadow: 0 0 0 .5px rgba(0, 0, 0, .08), 0 10px 28px -10px rgba(60, 35, 15, .35), 0 2px 6px rgba(60, 35, 15, .08);
  img { width: 74%; height: 74%; object-fit: contain; }
}
.acct__eyebrow { margin: 0; font-size: 13px; font-weight: 600; letter-spacing: .02em; color: $primary; }
.acct__lead { margin: 8px auto 0; max-width: 340px; font-size: 15px; line-height: 1.45; color: $text-2; }

.acct__form { display: flex; flex-direction: column; gap: 10px; }

// ---- Nhóm ô nhập (inset grouped) ----
.ios-group {
  background: $surface; border-radius: 14px; overflow: hidden;
  box-shadow: 0 0 0 .5px $border-strong, 0 1px 2px rgba(0, 0, 0, .04);
  > * + *, .ios-row > * + * { border-top: .5px solid $border-strong !important; }
}
// danh sách: đường kẻ thụt vào sau biểu tượng như iOS
.ios-list > .shop-item + .shop-item { border-top: 0 !important; position: relative;
  &::before { content: ''; position: absolute; top: 0; left: 66px; right: 0; height: .5px; background: $border-strong; } }
.ios-row { display: grid; grid-template-columns: 1fr 1fr; > * + * { border-top: 0 !important; border-left: .5px solid $border-strong; } }
.ios-field {
  position: relative; display: flex; flex-direction: column; gap: 2px; padding: 9px 16px 8px; cursor: text;
  transition: background .15s;
  > span { font-size: 12px; font-weight: 500; color: $text-2; i { font-style: normal; color: $text-muted; font-weight: 400; } }
  input {
    width: 100%; border: 0; outline: 0; padding: 0; background: transparent; color: $text;
    font: 400 17px/1.35 $font-family; letter-spacing: -0.01em;
    &::placeholder { color: $text-muted; opacity: .7; }
  }
  &:focus-within { background: color-mix(in srgb, var(--primary) 5%, transparent); > span { color: $primary; } }
  &--pw input { padding-right: 34px; }
  &__eye {
    position: absolute; right: 8px; bottom: 6px; width: 32px; height: 32px; border: 0; border-radius: 8px; background: transparent;
    color: $text-muted; display: grid; place-items: center; cursor: pointer;
    &:hover { color: $text; background: $fill; }
  }
}
.ios-caption { margin: 10px 4px -2px; font-size: 13px; font-weight: 500; color: $text-2; }
.acct__foot-note { margin: -2px 4px 0; font-size: 12.5px; line-height: 1.5; color: $text-muted; }

.acct__cta {
  height: 50px; margin-top: 8px; border-radius: 14px; font-size: 17px; font-weight: 600; letter-spacing: -0.01em; gap: 10px;
  box-shadow: 0 8px 20px -10px color-mix(in srgb, var(--primary) 70%, transparent);
}
.acct-switch { margin: 6px 0 0; text-align: center; font-size: 14px; color: $text-2; }
.acct__link {
  border: 0; background: none; padding: 4px 2px; font: inherit; font-weight: 600; color: $primary; cursor: pointer; border-radius: 6px;
  &:hover { text-decoration: underline; text-underline-offset: 3px; }
  &:disabled { opacity: .5; }
  &--muted { color: $text-muted; font-weight: 500; font-size: 12.5px; display: inline-flex; align-items: center; gap: 6px; }
}
.acct__back {
  align-self: flex-start; display: inline-flex; align-items: center; gap: 4px; margin: 0 0 2px -4px; padding: 6px 8px; border: 0; border-radius: 8px;
  background: none; color: $primary; font: 500 15px/1 $font-family; cursor: pointer;
  &:hover { background: $fill; }
}

// ---- Danh sách quán (như danh sách trong Cài đặt của iPhone) ----
.ios-list { display: flex; flex-direction: column; }
.shop-item {
  display: flex; align-items: center; gap: 12px; width: 100%; padding: 12px 14px 12px 14px; border: 0; background: transparent;
  text-align: left; cursor: pointer; font: inherit; color: $text; transition: background .15s;
  &:hover { background: $fill; } &:active { background: $border; }
  &__icon {
    width: 40px; height: 40px; border-radius: 10px; flex-shrink: 0; display: grid; place-items: center;
    background: linear-gradient(160deg, color-mix(in srgb, var(--primary) 78%, #fff), var(--primary)); color: $on-primary;
    font: 700 17px/1 $font-display; box-shadow: inset 0 0 0 .5px rgba(0, 0, 0, .08);
  }
  &__txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px;
    b { font-size: 16px; font-weight: 600; letter-spacing: -0.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    small { font-size: 13px; color: $text-2; } }
  &__check { color: $primary; }
  &__chev { color: $text-muted; }
  &.active small { color: $primary; }
  &--add { .shop-item__icon { background: $fill; color: $primary; box-shadow: none; } b { color: $primary; } }
}

// ---- Chọn dữ liệu ban đầu ----
.src-pick {
  display: flex; flex-direction: column;
  button {
    display: flex; align-items: flex-start; gap: 12px; padding: 12px 16px; border: 0; background: transparent; text-align: left;
    font: inherit; color: $text; cursor: pointer;
    > span:last-child { display: flex; flex-direction: column; gap: 2px; b { font-size: 15px; font-weight: 600; } small { font-size: 12.5px; color: $text-2; line-height: 1.4; } }
    &:hover { background: $fill; }
  }
  &__radio { flex-shrink: 0; width: 20px; height: 20px; margin-top: 1px; border-radius: 50%; box-shadow: inset 0 0 0 1.5px $border-strong; transition: box-shadow .2s; }
  button.active .src-pick__radio { box-shadow: inset 0 0 0 6px var(--primary); }
}

// ---- Thông báo ----
.acct__note {
  display: flex; gap: 10px; align-items: flex-start; margin: 0; padding: 12px 14px; border-radius: 14px; font-size: 13.5px; line-height: 1.5;
  background: color-mix(in srgb, var(--primary) 9%, var(--surface)); color: $text;
  .icon { color: $primary; margin-top: 2px; flex-shrink: 0; }
  .acct__link { margin-left: auto; flex-shrink: 0; }
  &--warn { background: $warning-soft; .icon { color: $warning; } }
}

// ---- Tài khoản đang đăng nhập ----
.acct__me {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 8px; padding: 12px 4px 0; border-top: .5px solid $border-strong; font-size: 14px;
}
.acct__avatar { width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; background: $fill; color: $text; font-weight: 600; font-size: 13px; }
.acct__email { flex: 1; min-width: 0; color: $text-2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.acct__legal { margin: 8px 0 0; text-align: center; font-size: 12px; color: $text-muted; display: flex; align-items: center; justify-content: center; gap: 6px; }

.acct__loading { display: grid; place-items: center; padding: 40px 0; }
.spin { width: 18px; height: 18px; border-radius: 50%; border: 2px solid $border-strong; border-top-color: $primary; animation: spin .8s linear infinite; display: inline-block; }
.spin--light { width: 16px; height: 16px; border-color: rgba(255, 255, 255, .35); border-top-color: #fff; }
@keyframes spin { to { transform: rotate(360deg); } }

// ---- Xuất hiện lần lượt sau màn chào: biểu tượng, tiêu đề, ô nhập, nút ----
.acct__wrap > * { opacity: 0; }
.acct__wrap.is-in > * { animation: acctIn .6s $ease-out both; }
.acct__wrap.is-in .acct__form > * { animation: acctIn .55s $ease-out both; }
@for $i from 1 through 8 {
  .acct__wrap.is-in > :nth-child(#{$i}) { animation-delay: #{($i - 1) * 70ms}; }
  .acct__wrap.is-in .acct__form > :nth-child(#{$i}) { animation-delay: #{120 + ($i - 1) * 60ms}; }
}
.acct__wrap.is-in .acct__icon { animation: acctIconIn .8s cubic-bezier(.2, 1.3, .3, 1) both; }
@keyframes acctIn { from { opacity: 0; transform: translateY(14px); filter: blur(3px); } to { opacity: 1; transform: none; filter: none; } }
@keyframes acctIconIn { from { opacity: 0; transform: scale(.7); } to { opacity: 1; transform: none; } }
[data-motion='off'] .acct__wrap > *, [data-motion='off'] .acct__wrap .acct__form > * { animation: none !important; opacity: 1; }
@media (prefers-reduced-motion: reduce) { .acct__wrap > *, .acct__wrap .acct__form > * { animation: none !important; opacity: 1; } }

// Chuyển giữa các bước: mờ dần + trượt nhẹ
.acct-step-enter-active { transition: opacity .28s $ease-out, transform .32s $ease-out; }
.acct-step-leave-active { transition: opacity .12s ease-in; }
.acct-step-enter-from { opacity: 0; transform: translateY(8px); }
.acct-step-leave-to { opacity: 0; }

// Máy tính: đặt trong khung nổi nhẹ cho gọn mắt
@media (min-width: 720px) {
  .acct { padding: 40px 20px; }
  // margin auto: căn giữa theo chiều dọc nhưng không bị cắt đầu khi nội dung cao hơn màn hình
  .acct__wrap { margin: auto 0; max-width: 460px; padding: 40px 40px 28px; border-radius: 28px; background: color-mix(in srgb, var(--surface) 70%, transparent);
    box-shadow: 0 0 0 .5px $border-strong, 0 30px 60px -30px rgba(60, 35, 15, .25); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); }
}
</style>
