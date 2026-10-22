<script setup>
/**
 * TÀI KHOẢN CHỦ QUÁN (hệ thống nhiều quán)
 *  - Đăng ký / đăng nhập bằng email + mật khẩu
 *  - Danh sách quán của tài khoản → chọn quán để mở trên máy này
 *  - Tạo quán mới (trống) hoặc đưa dữ liệu đang có trên máy này lên làm 1 quán
 * Mỗi quán có dữ liệu riêng hoàn toàn; nhân viên vào quán bằng PIN như trước.
 */
import { ref, reactive, computed, onMounted } from 'vue'
import Icon from '../components/ui/Icon.vue'
import logo from '../assets/image/logo.png'
import { useUi } from '../stores/ui'
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
const IMPORTED = LEGACY_PREFIX + 'importedTo'
const legacyAvailable = computed(() => hasLegacyData() && !localStorage.getItem(IMPORTED))
const form = reactive({ name: '', address: '', phone: '', ownerName: '', pin: '', pin2: '', source: 'blank' })
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
    // không để vòng quay chờ mãi khi mất mạng
    if (session.value) shops.value = await Promise.race([conn.value.listShops(), new Promise((_, rej) => setTimeout(() => rej(new Error('Không kết nối được máy chủ — kiểm tra mạng')), 12000))])
    // máy đang mở 1 quán và tài khoản vẫn còn quyền -> cập nhật tên quán đang lưu
    const cur = shops.value.find((s) => s.id === activeShopId)
    if (cur && cur.name !== activeShop?.name) setActiveShop(cur)
  } catch (e) {
    err.value = e.message || String(e)
  } finally {
    loading.value = false
  }
}
onMounted(load)

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
  if (cred.password.length < 6) return ui.toast('Mật khẩu cần ít nhất 6 ký tự', 'error')
  if (mode.value === 'signup' && cred.password !== cred.password2) return ui.toast('Hai lần nhập mật khẩu không khớp', 'error')
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
    await load()
    if (!shops.value.length) creating.value = true
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
  const blank = f.source === 'blank'
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
      localStorage.setItem(p + 'init', JSON.stringify({ name: f.name.trim(), address: f.address, phone: f.phone, ownerName: f.ownerName.trim(), pin: f.pin }))
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

async function logout() {
  // Còn thay đổi chưa gửi lên máy chủ -> không cho đăng xuất (đăng xuất sẽ xoá dữ liệu quán trên máy này)
  if (activeShopId) {
    const { sync } = await import('../sync/engine')
    const n = sync.pendingCount()
    if (n) return ui.toast(`Còn ${n} thay đổi chưa gửi lên máy chủ — kết nối mạng, chờ đồng bộ xong rồi đăng xuất`, 'error')
  }
  if (!(await ui.confirm('Đăng xuất tài khoản trên máy này? Dữ liệu các quán sẽ được xoá khỏi máy này (vẫn còn nguyên trên máy chủ, đăng nhập lại là có).', { okText: 'Đăng xuất', danger: true }))) return
  busy.value = true
  await conn.value.signOut()
  shops.value.forEach((s) => forgetShopData(s.id))
  if (activeShopId) forgetShopData(activeShopId)
  setActiveShop(null)
  localStorage.removeItem('dreamers-sb-auth')
  location.hash = '#/account'
  location.reload()
}

const email = computed(() => session.value?.user?.email || '')
</script>

<template>
  <div class="acct">
    <div class="acct__card">
      <header class="acct__head">
        <img :src="logo" alt="" class="acct__logo" />
        <div>
          <h1>{{ session ? 'Quán của bạn' : 'Tài khoản chủ quán' }}</h1>
          <p class="muted">Mỗi quán có dữ liệu riêng: menu, phòng, hoá đơn, nhân viên.</p>
        </div>
      </header>

      <!-- Lỗi mở quán -->
      <div v-if="boot.state === 'error'" class="acct__note acct__note--warn">
        <Icon name="fa-wifi-slash" :size="16" />
        <span>Không tải được dữ liệu quán {{ activeShop?.name }}: {{ boot.error }}. Lần đầu mở quán trên máy này cần có mạng.</span>
        <button class="btn btn--sm btn--primary" @click="reopen">Thử lại</button>
      </div>

      <!-- Chưa cài máy chủ -->
      <section v-if="!configured" class="acct__sec">
        <div class="acct__note"><Icon name="fa-server" :size="16" /><span>Bản app này chưa cài máy chủ. Nhập địa chỉ và khoá công khai của dự án Supabase (Project Settings › API).</span></div>
        <div class="field"><label>Địa chỉ máy chủ (Project URL)</label><input class="input" v-model="server.url" placeholder="https://xxxx.supabase.co" autocomplete="off" /></div>
        <div class="field"><label>Khoá công khai (anon public key)</label><input class="input" v-model="server.key" placeholder="eyJhbGciOi..." autocomplete="off" /></div>
        <button class="btn btn--primary btn--block" @click="saveServer">Lưu máy chủ</button>
      </section>

      <div v-else-if="loading" class="acct__loading"><span class="spin"></span> Đang tải…</div>

      <!-- Đăng nhập / đăng ký -->
      <section v-if="configured && !loading && !session" class="acct__sec">
        <div v-if="boot.state === 'needSession'" class="acct__note">
          <Icon name="fa-store" :size="16" /><span>Đăng nhập tài khoản chủ quán để mở <b>{{ activeShop?.name }}</b> trên máy này.</span>
        </div>
        <div class="segmented segmented--full acct__tabs">
          <button :class="{ active: mode === 'signin' }" @click="mode = 'signin'">Đăng nhập</button>
          <button :class="{ active: mode === 'signup' }" @click="mode = 'signup'">Đăng ký quán mới</button>
        </div>
        <form class="acct__form" @submit.prevent="submitCred">
          <div class="field"><label>Email</label><input class="input" type="email" v-model="cred.email" autocomplete="email" inputmode="email" /></div>
          <div class="field"><label>Mật khẩu</label><input class="input" type="password" v-model="cred.password" :autocomplete="mode === 'signin' ? 'current-password' : 'new-password'" /></div>
          <div v-if="mode === 'signup'" class="field"><label>Nhập lại mật khẩu</label><input class="input" type="password" v-model="cred.password2" autocomplete="new-password" /></div>
          <button class="btn btn--primary btn--lg btn--block" :disabled="busy">{{ mode === 'signin' ? 'Đăng nhập' : 'Tạo tài khoản' }}</button>
        </form>
        <p class="muted acct__small">Tài khoản này dành cho <b>chủ quán</b> (đăng nhập 1 lần trên mỗi máy của quán). Nhân viên vẫn vào ca bằng mã PIN.</p>
      </section>

      <!-- Đã đăng nhập: danh sách quán -->
      <section v-if="configured && !loading && session" class="acct__sec">
        <p v-if="err" class="acct__note acct__note--warn"><Icon name="fa-triangle-exclamation" :size="16" /><span>{{ err }}</span></p>

        <div v-if="shops.length && !creating" class="shop-list">
          <button v-for="s in shops" :key="s.id" class="shop-item" :class="{ active: s.id === activeShopId }" @click="open(s)">
            <span class="shop-item__icon"><Icon name="fa-store" :size="18" /></span>
            <span class="shop-item__txt"><b>{{ s.name }}</b><small>{{ s.id === activeShopId ? 'Đang mở trên máy này' : 'Bấm để mở trên máy này' }}</small></span>
            <Icon name="right" :size="16" />
          </button>
        </div>
        <button v-if="!creating" class="btn btn--ghost btn--block" @click="creating = true"><Icon name="plus" :size="15" />Tạo quán mới</button>

        <!-- Tạo quán -->
        <form v-if="creating" class="acct__form" @submit.prevent="createShop">
          <h3>Tạo quán mới</h3>
          <div class="field"><label>Tên quán *</label><input class="input" v-model="form.name" placeholder="VD: Mây Coffee & Homestay" /></div>
          <div class="field"><label>Địa chỉ</label><input class="input" v-model="form.address" /></div>
          <div class="field"><label>Điện thoại</label><input class="input" type="tel" inputmode="tel" v-model="form.phone" /></div>

          <div v-if="legacyAvailable" class="field">
            <label>Dữ liệu ban đầu</label>
            <div class="src-pick">
              <button type="button" :class="{ active: form.source === 'blank' }" @click="form.source = 'blank'">
                <b>Quán trống</b><small>Tự thêm menu, phòng, nhân viên</small>
              </button>
              <button type="button" :class="{ active: form.source === 'legacy' }" @click="form.source = 'legacy'">
                <b>Dữ liệu đang có trên máy này</b>
                <small>{{ legacySummary.name || 'Quán hiện tại' }} · {{ legacySummary.products }} món · {{ legacySummary.rooms }} phòng · {{ legacySummary.invoices }} hoá đơn · {{ legacySummary.users }} nhân viên</small>
              </button>
            </div>
          </div>

          <template v-if="form.source === 'blank'">
            <div class="field"><label>Tên của bạn (hiện ở màn hình chọn người) *</label><input class="input" v-model="form.ownerName" /></div>
            <div class="acct__row">
              <div class="field"><label>Mã PIN 6 số *</label><input class="input num" type="password" inputmode="numeric" maxlength="6" v-model="form.pin" autocomplete="new-password" /></div>
              <div class="field"><label>Nhập lại PIN *</label><input class="input num" type="password" inputmode="numeric" maxlength="6" v-model="form.pin2" autocomplete="new-password" /></div>
            </div>
          </template>
          <p v-else class="muted acct__small">Nhân viên và mã PIN giữ nguyên như đang dùng.</p>

          <div class="acct__row">
            <button v-if="shops.length" type="button" class="btn btn--ghost" @click="creating = false">Huỷ</button>
            <button class="btn btn--primary" :disabled="busy" style="flex: 1">Tạo quán & mở</button>
          </div>
        </form>

        <footer class="acct__foot">
          <span class="muted"><Icon name="fa-user" :size="13" /> {{ email }}</span>
          <div class="acct__row">
            <button v-if="activeShopId && boot.state === 'ready'" class="btn btn--plain btn--sm" @click="open(activeShop)">Quay lại quán</button>
            <button class="btn btn--plain btn--sm" :disabled="busy" @click="logout">Đăng xuất</button>
          </div>
        </footer>
      </section>
    </div>
  </div>
</template>

<style lang="scss">
@use '../styles/tokens' as *;
.acct {
  min-height: 100vh; min-height: 100dvh; display: grid; place-items: center; padding: 24px 16px calc(24px + var(--safe-bottom));
  &__card { width: 100%; max-width: 460px; padding: 26px; border-radius: 22px; background: $surface; box-shadow: $shadow-lg; display: flex; flex-direction: column; gap: 18px; }
  &__head { display: flex; gap: 14px; align-items: center; h1 { font-size: 22px; margin: 0; letter-spacing: -0.02em; } p { margin: 2px 0 0; font-size: 13px; } }
  &__logo { width: 52px; height: 52px; object-fit: contain; border-radius: 14px; background: #fff; box-shadow: inset 0 0 0 1px $border; padding: 6px; }
  &__sec, &__form { display: flex; flex-direction: column; gap: 12px; h3 { margin: 4px 0 0; font-size: 16px; } }
  &__tabs { margin-bottom: 2px; }
  &__row { display: flex; gap: 10px; align-items: flex-end; > .field { flex: 1; } }
  &__small { font-size: 12px; margin: 0; line-height: 1.5; }
  &__loading { display: flex; align-items: center; gap: 10px; color: $text-2; padding: 20px 0; justify-content: center; }
  &__note { display: flex; gap: 10px; align-items: flex-start; padding: 12px 14px; border-radius: 12px; background: $primary-soft; color: $text; font-size: 13px; line-height: 1.5; margin: 0;
    .icon { color: $primary; margin-top: 2px; flex-shrink: 0; } .btn { margin-left: auto; flex-shrink: 0; }
    &--warn { background: $warning-soft; .icon { color: $warning; } } }
  &__foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding-top: 12px; border-top: 1px solid $border; flex-wrap: wrap; font-size: 13px; }
}
.shop-list { display: flex; flex-direction: column; gap: 8px; }
.shop-item {
  display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: 0; border-radius: 14px; text-align: left; cursor: pointer;
  background: $surface-2; box-shadow: inset 0 0 0 1px $border; font: inherit; color: $text;
  &:hover { background: $fill; }
  &.active { box-shadow: inset 0 0 0 2px $primary; background: $primary-soft; }
  &__icon { width: 38px; height: 38px; border-radius: 10px; display: grid; place-items: center; background: $surface; color: $primary; flex-shrink: 0; }
  &__txt { flex: 1; min-width: 0; display: flex; flex-direction: column; b { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } small { color: $text-2; font-size: 12px; } }
}
.src-pick {
  display: grid; gap: 8px;
  button { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; text-align: left; border: 0; border-radius: 12px; cursor: pointer;
    background: $surface; box-shadow: inset 0 0 0 1px $border-strong; font: inherit; color: $text;
    small { font-size: 12px; color: $text-2; }
    &.active { background: $primary-soft; box-shadow: inset 0 0 0 2px $primary; b { color: $primary; } } }
}
.spin { width: 16px; height: 16px; border-radius: 50%; border: 2px solid $border-strong; border-top-color: $primary; animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
