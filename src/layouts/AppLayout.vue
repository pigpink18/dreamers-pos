<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Icon from '../components/ui/Icon.vue'
import { lockScroll, unlockScroll } from '../utils/scrollLock'
import ShiftOpenModal from '../components/shifts/ShiftOpenModal.vue'
import ShiftCloseModal from '../components/shifts/ShiftCloseModal.vue'
import { useUi } from '../stores/ui'
import { useRooms } from '../stores/rooms'
import { useAuth, initials } from '../stores/auth'
import { useShifts } from '../stores/shifts'
import { useSettings } from '../stores/settings'
import { isLegacy } from '../tenant'
import { useAppearance } from '../stores/theme'
import { fmtDate, weekday, dateKey, fmtTime } from '../utils/format'
import logoMark from '../assets/image/logo-mark.png'
import { sync } from '../sync/engine'

const route = useRoute()
const router = useRouter()
const ui = useUi()
const rooms = useRooms()
const auth = useAuth()
const shifts = useShifts()
const settings = useSettings()
// Thương hiệu trên menu: Dreamers giữ logo con sóc; quán khác hiện tên quán của mình
const isDreamers = computed(() => isLegacy || /dreamers/i.test(settings.shop.name || ''))
const brandName = computed(() => (isDreamers.value ? 'Dreamers' : settings.shop.name || 'Quán của bạn'))
const brandSub = computed(() => (isDreamers.value ? 'Home & Coffee' : settings.shop.address || 'Bán hàng & phòng'))
const appearance = useAppearance()
const today = dateKey()
const horizontal = computed(() => appearance.prefs.layout === 'horizontal')

// ---- Menu: chỉ hiện trang người dùng có quyền ----
const allowed = computed(() =>
  router.options.routes.filter((r) => r.meta && !r.meta.hidden && !r.redirect && (!r.meta.perm || auth.can(r.meta.perm)))
)
const groups = computed(() => {
  const g = {}
  allowed.value.forEach((r) => (g[r.meta.group || ''] ||= []).push(r))
  return g
})

// ---- Điện thoại: tab bar 4 mục chính + "Thêm" ----
const tabRoutes = computed(() => allowed.value.slice(0, 4))
const moreRoutes = computed(() => allowed.value.slice(4))
const moreOpen = ref(false)
const inMore = computed(() => moreRoutes.value.some((r) => r.name === route.name))
// Vị trí "viên kính" trượt dưới tab đang chọn
const tabCount = computed(() => tabRoutes.value.length + (moreRoutes.value.length ? 1 : 0))
const tabIndex = computed(() => {
  if (moreOpen.value || inMore.value) return tabRoutes.value.length
  return tabRoutes.value.findIndex((r) => r.name === route.name)
})
// Đo đúng vị trí & bề rộng của tab đang chọn để viên kính nằm chính giữa tab (không tính chia đều theo công thức)
const glassEl = ref(null)
const lens = ref({ x: 0, w: 0 })
function measureLens() {
  const items = glassEl.value?.querySelectorAll('.tabbar__item')
  const el = items?.[tabIndex.value]
  if (el) lens.value = { x: el.offsetLeft, w: el.offsetWidth }
}
watch([tabIndex, tabCount], () => requestAnimationFrame(measureLens), { flush: 'post' })
// Đo lại khi thanh tab đổi kích thước (lúc mở app, xoay máy, font tải xong...)
let lensRO = null
onMounted(() => {
  requestAnimationFrame(measureLens)
  if (window.ResizeObserver && glassEl.value) { lensRO = new ResizeObserver(measureLens); lensRO.observe(glassEl.value) }
  window.addEventListener('resize', measureLens)
  document.fonts?.ready?.then(measureLens)
})
onBeforeUnmount(() => { lensRO?.disconnect(); window.removeEventListener('resize', measureLens) })

// ---- Hướng chuyển trang: đi tới mục phía sau trong menu = trượt sang trái, quay lại = trượt sang phải ----
const order = router.options.routes.map((r) => r.name)
const pageTransition = ref('page-fade')
watch(() => route.name, (to, from) => {
  const a = order.indexOf(from), b = order.indexOf(to)
  pageTransition.value = a < 0 || b < 0 ? 'page-fade' : b > a ? 'page-fwd' : b < a ? 'page-back' : 'page-fade'
})

// ---- Menu người dùng ----
const userMenu = ref(false)
const openGroup = ref(null) // menu ngang: nhóm đang mở
// Esc đóng bảng Thêm
const onMoreKey = (e) => e.key === 'Escape' && (moreOpen.value = false)
watch(moreOpen, (v) => {
  if (v) { window.addEventListener('keydown', onMoreKey); lockScroll() }
  else { window.removeEventListener('keydown', onMoreKey); unlockScroll() }
})
watch(() => route.path, () => { moreOpen.value = false; userMenu.value = false; openGroup.value = null })
const roleName = computed(() => auth.role?.name || '')
const roleColor = computed(() => auth.role?.color || 'var(--primary)')

function lockScreen() {
  auth.lock()
  router.push('/login')
}
async function logout() {
  if (shifts.current && shifts.current.userId === auth.user?.id &&
    !(await ui.confirm(`Ca ${shifts.current.code} vẫn đang mở. Đăng xuất mà không đóng ca?`, { okText: 'Vẫn đăng xuất' }))) return
  auth.logout()
  router.push('/login')
}

// ---- Ca làm việc ----
const showOpenShift = ref(false)
const showCloseShift = ref(false)
function onShiftClick() {
  if (!auth.can('shifts.open')) return ui.toast('Bạn không có quyền mở/đóng ca', 'error')
  if (shifts.current) showCloseShift.value = true
  else showOpenShift.value = true
}

// ---- Tự khoá khi không thao tác ----
let idleTimer
const EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart']
function resetIdle() {
  clearTimeout(idleTimer)
  const min = +settings.ops.autoLockMin
  if (min > 0) idleTimer = setTimeout(lockScreen, min * 60000)
}
onMounted(() => { EVENTS.forEach((e) => window.addEventListener(e, resetIdle, { passive: true })); resetIdle() })
onBeforeUnmount(() => { EVENTS.forEach((e) => window.removeEventListener(e, resetIdle)); clearTimeout(idleTimer) })
watch(() => settings.ops.autoLockMin, resetIdle)

function closeMenus(e) {
  if (!e.target.closest('.user-menu, .hnav__group')) { userMenu.value = false; openGroup.value = null }
}
onMounted(() => document.addEventListener('click', closeMenus))
onBeforeUnmount(() => document.removeEventListener('click', closeMenus))
</script>

<template>
  <div class="shell" :class="{ 'is-full': route.meta.full, 'is-horizontal': horizontal }">
    <!-- ============ MENU DỌC ============ -->
    <aside v-if="!horizontal" class="sidebar">
      <div class="brand">
        <div class="brand__logo" :class="{ 'brand__logo--generic': !isDreamers }">
          <img v-if="isDreamers" :src="logoMark" alt="Dreamers" />
          <Icon v-else name="fa-mug-saucer" :size="20" />
        </div>
        <div class="brand__text">
          <div class="brand__name">{{ brandName }}</div>
          <div class="brand__shop">{{ brandSub }}</div>
        </div>
      </div>

      <nav>
        <template v-for="(items, group) in groups" :key="group">
          <div v-if="group" class="nav-group">{{ group }}</div>
          <RouterLink v-for="r in items" :key="r.path" :to="r.path" class="nav-link" active-class="" exact-active-class="active">
            <Icon :name="r.meta.icon" :size="17" class="nav-link__icon" />
            <span>{{ r.meta.title }}</span>
            <span v-if="r.name === 'rooms'" class="nav-pill" title="Phòng đang có khách">{{ rooms.summary.occupied }}/{{ rooms.rooms.length }}</span>
          </RouterLink>
        </template>
      </nav>

      <RouterLink v-if="auth.can('pos.sell')" to="/pos" class="btn btn--primary btn--block sidebar__cta">
        <Icon name="cart" :size="15" /> Bán hàng
      </RouterLink>
    </aside>

    <div class="main">
      <!-- ============ THANH TRÊN ============ -->
      <header class="topbar">
        <!-- Logo: hiện ở menu ngang và trên điện thoại -->
        <RouterLink to="/" class="topbar__brand" :class="{ 'only-mobile-flex': !horizontal }">
          <div class="brand__logo brand__logo--sm" :class="{ 'brand__logo--generic': !isDreamers }">
            <img v-if="isDreamers" :src="logoMark" alt="" />
            <Icon v-else name="fa-mug-saucer" :size="16" />
          </div>
          <span>{{ brandName }}</span>
        </RouterLink>

        <!-- MENU NGANG -->
        <nav v-if="horizontal" class="hnav hide-tablet">
          <template v-for="(items, group) in groups" :key="group">
            <template v-if="!group">
              <RouterLink v-for="r in items" :key="r.path" :to="r.path" class="hnav__link" active-class="" exact-active-class="active">
                <Icon :name="r.meta.icon" :size="15" /> {{ r.meta.title }}
              </RouterLink>
            </template>
            <div v-else class="hnav__group" :class="{ active: items.some((r) => r.name === route.name) }">
              <button class="hnav__link" @click="openGroup = openGroup === group ? null : group">
                {{ group }} <Icon name="fa-chevron-down" :size="11" />
              </button>
              <Transition name="drop">
                <div v-if="openGroup === group" class="dropdown">
                  <RouterLink v-for="r in items" :key="r.path" :to="r.path" class="dropdown__item" exact-active-class="active">
                    <Icon :name="r.meta.icon" :size="15" /> {{ r.meta.title }}
                  </RouterLink>
                </div>
              </Transition>
            </div>
          </template>
        </nav>
        <h2 v-else class="topbar__title hide-mobile">{{ route.meta.title }}</h2>

        <div class="spacer"></div>

        <!-- Trạng thái đồng bộ máy chủ (chỉ hiện khi đã kết nối) -->
        <RouterLink v-if="sync.status.state !== 'off'" to="/settings?tab=server" class="sync-pill" :class="`is-${sync.status.state}`"
          :title="sync.status.state === 'online' ? 'Đã đồng bộ với máy chủ' : sync.status.state === 'offline' ? 'Mất kết nối máy chủ — dữ liệu vẫn lưu trên máy' : 'Đang kết nối máy chủ'">
          <Icon :name="sync.status.state === 'offline' ? 'fa-cloud-slash' : 'fa-cloud'" :size="15" />
          <span v-if="sync.status.pending" class="sync-pill__n num">{{ sync.status.pending }}</span>
        </RouterLink>

        <!-- Trạng thái ca -->
        <button class="shift-pill" :class="shifts.current ? 'is-open' : 'is-closed'" @click="onShiftClick"
          :title="shifts.current ? 'Bấm để đóng ca' : 'Bấm để mở ca'">
          <span class="shift-pill__dot"></span>
          <span v-if="shifts.current" class="hide-mobile">Ca {{ shifts.current.code }} · từ {{ fmtTime(shifts.current.openedAt) }}</span>
          <span v-if="shifts.current" class="only-mobile">{{ shifts.current.code }}</span>
          <span v-else>Chưa mở ca</span>
        </button>

        <div class="topbar__date hide-tablet">{{ weekday(today) }}, {{ fmtDate(today) }}</div>

        <!-- Người dùng -->
        <div class="user-menu">
          <button class="user-menu__btn" @click="userMenu = !userMenu" aria-label="Tài khoản">
            <span class="avatar" :style="{ background: roleColor }">{{ initials(auth.user?.name) }}</span>
            <span class="user-menu__who hide-tablet"><b>{{ auth.user?.name }}</b><small>{{ roleName }}</small></span>
            <Icon name="fa-chevron-down" :size="11" class="hide-tablet muted" />
          </button>
          <Transition name="drop">
            <div v-if="userMenu" class="dropdown dropdown--right">
              <div class="dropdown__head">
                <span class="avatar" :style="{ background: roleColor }">{{ initials(auth.user?.name) }}</span>
                <div><b>{{ auth.user?.name }}</b><small>{{ roleName }}</small></div>
              </div>
              <button v-if="auth.can('shifts.open')" class="dropdown__item" @click="onShiftClick(); userMenu = false">
                <Icon name="fa-cash-register" :size="15" /> {{ shifts.current ? `Đóng ca ${shifts.current.code}` : 'Mở ca' }}
              </button>
              <RouterLink to="/settings?tab=appearance" class="dropdown__item"><Icon name="fa-palette" :size="15" /> Giao diện</RouterLink>
              <button class="dropdown__item" @click="lockScreen"><Icon name="fa-lock" :size="15" /> Khoá màn hình</button>
              <button class="dropdown__item" @click="lockScreen"><Icon name="fa-arrow-right-arrow-left" :size="15" /> Đổi người dùng</button>
              <div class="dropdown__sep"></div>
              <button class="dropdown__item danger" @click="logout"><Icon name="logout" :size="15" /> Đăng xuất</button>
            </div>
          </Transition>
        </div>
      </header>

      <main class="content">
        <RouterView v-slot="{ Component }">
          <Transition :name="pageTransition" mode="out-in"><component :is="Component" /></Transition>
        </RouterView>
      </main>
    </div>

    <!-- ============ TAB BAR (điện thoại / máy tính bảng) ============ -->
    <nav class="tabbar" aria-label="Điều hướng chính" :style="{ '--n': tabCount, '--i': Math.max(0, tabIndex) }">
      <div ref="glassEl" class="tabbar__glass">
        <span class="tabbar__lens" :class="{ hidden: tabIndex < 0 || !lens.w }" :style="{ width: lens.w + 'px', transform: `translateX(${lens.x}px)` }" aria-hidden="true"></span>
        <RouterLink v-for="r in tabRoutes" :key="r.name" :to="r.path" class="tabbar__item" active-class="" exact-active-class="active">
          <Icon :name="r.meta.icon" :size="20" />
          <span>{{ r.meta.tab || r.meta.title }}</span>
        </RouterLink>
        <button v-if="moreRoutes.length" class="tabbar__item" :class="{ active: inMore || moreOpen }" @click="moreOpen = true">
          <Icon name="fa-ellipsis" :size="20" />
          <span>Thêm</span>
        </button>
      </div>
    </nav>

    <Teleport to="body">
      <!-- Bảng "Thêm" trên điện thoại. Chạm ra ngoài, nút X, hoặc chọn mục nào cũng đóng bảng (iOS cần cursor:pointer để nhận chạm) -->
      <div v-if="moreOpen" class="modal-backdrop more-backdrop" @click.self="moreOpen = false">
        <div class="modal more-sheet" role="dialog" aria-modal="true" aria-label="Thêm">
          <header class="modal__header">
            <h3>Thêm</h3>
            <button class="btn btn--ghost btn--icon btn--sm modal__close" aria-label="Đóng" @click="moreOpen = false"><Icon name="x" :size="16" /></button>
          </header>
          <div class="more-sheet__list">
            <RouterLink v-for="r in moreRoutes" :key="r.name" :to="r.path" class="more-sheet__item" @click="moreOpen = false">
              <span class="more-sheet__icon"><Icon :name="r.meta.icon" :size="18" /></span>
              <span>{{ r.meta.title }}</span>
              <Icon name="right" :size="14" class="muted" style="margin-left: auto" />
            </RouterLink>
            <button class="more-sheet__item" @click="moreOpen = false; lockScreen()">
              <span class="more-sheet__icon"><Icon name="fa-lock" :size="18" /></span><span>Khoá màn hình / đổi người</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <ShiftOpenModal v-if="showOpenShift || ui.shiftRequest" @opened="ui.resolveShift(true)" @close="showOpenShift = false; ui.shiftRequest && ui.resolveShift(false)" />
    <ShiftCloseModal v-if="showCloseShift" @close="showCloseShift = false" />

  </div>
</template>

<style lang="scss">
@use '../styles/tokens' as *;

.shell { display: flex; min-height: 100vh; min-height: 100dvh; }

// ---------- Menu dọc ----------
.sidebar {
  position: fixed; inset: 0 auto 0 0; width: $sidebar-w; z-index: 50;
  @include vibrancy($sidebar-bg);
  border-right: 1px solid $border;
  display: flex; flex-direction: column; padding: 16px 12px 14px;
  nav { flex: 1; overflow-y: auto; margin-top: 8px; }
  &__cta { margin-top: 10px; height: 38px; }
}
.brand {
  display: flex; align-items: center; gap: 10px; padding: 2px 8px 14px;
  // Logo con sóc của Dreamers trên nền trắng, kiểu icon app của Apple
  &__logo {
    width: 34px; height: 34px; border-radius: 9px; flex-shrink: 0;
    display: grid; place-items: center; background: #fffdfa;
    box-shadow: 0 0 0 .5px $border-strong, $shadow-sm;
    img { width: 78%; height: 78%; object-fit: contain; }
    &--sm { width: 30px; height: 30px; border-radius: 8px; }
    &--generic { background: $primary; color: $on-primary; box-shadow: $shadow-sm; }
  }
  &__text { min-width: 0; line-height: 1.25; }
  &__name { font-weight: 600; font-size: 15px; letter-spacing: -0.015em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  &__shop { font-size: 12px; color: $text-muted; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
}
.nav-group { font-size: 11px; font-weight: 600; color: $text-muted; padding: 16px 10px 5px; }
.nav-link {
  display: flex; align-items: center; gap: 10px; height: 32px; padding: 0 10px; margin: 1px 0;
  color: $text; border-radius: 8px; font-size: 14px; font-weight: 450;
  transition: background .15s $ease;
  &__icon { width: 20px; color: $primary; }
  &:hover { background: $fill; }
  &.active { background: tint($primary, .13); font-weight: 600; color: $primary; }
}
.nav-pill { margin-left: auto; font-size: 11px; font-weight: 600; color: $text-muted; }

// ---------- Khung chính & thanh trên ----------
.main {
  flex: 1; margin-left: $sidebar-w; min-width: 0; display: flex; flex-direction: column;
}
.is-horizontal .main { margin-left: 0; }
.topbar {
  position: sticky; top: 0; z-index: 40; height: $topbar-h;
  display: flex; align-items: center; gap: 12px; padding: 0 32px;
  @include vibrancy(var(--topbar-bg));
  &__title { font-size: 15px; font-weight: 600; }
  &__date { color: $text-2; font-size: 13px; white-space: nowrap; }
  &__brand { display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 16px; color: $text; flex-shrink: 0; min-width: 0; > span { max-width: 44vw; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } }
  &__brand.only-mobile-flex { display: none; }
}
.is-horizontal .topbar { border-bottom: 1px solid $border; gap: 18px; }

// ---------- Menu ngang ----------
.hnav { display: flex; align-items: center; gap: 2px; min-width: 0; }
.hnav__link {
  display: inline-flex; align-items: center; gap: 7px; height: 34px; padding: 0 12px; border-radius: 9px; border: 0; background: transparent;
  font: inherit; font-size: 14px; font-weight: 500; color: $text-2; cursor: pointer; white-space: nowrap;
  .icon { color: $primary; }
  &:hover { background: $fill; color: $text; }
  &.active { background: tint($primary, .13); color: $primary; font-weight: 600; }
}
.hnav__group { position: relative; &.active > .hnav__link { color: $primary; font-weight: 600; } }

// ---------- Dropdown dùng chung ----------
.dropdown {
  position: absolute; top: calc(100% + 6px); left: 0; z-index: 70; min-width: 220px; padding: 6px;
  @include vibrancy(var(--menu-bg)); border-radius: 14px; box-shadow: $shadow-lg, 0 0 0 .5px $border;
  &--right { left: auto; right: 0; }
  &__head { display: flex; gap: 10px; align-items: center; padding: 8px 10px 12px; border-bottom: 1px solid $border; margin-bottom: 4px;
    b { display: block; } small { color: $text-muted; } }
  &__item {
    display: flex; align-items: center; gap: 10px; width: 100%; height: 36px; padding: 0 10px; border: 0; border-radius: 8px;
    background: transparent; font: inherit; font-size: 14px; color: $text; cursor: pointer; text-align: left;
    .icon { color: $text-2; width: 18px; }
    &:hover { background: $primary; color: $on-primary; .icon { color: $on-primary; } }
    &.active { color: $primary; font-weight: 600; .icon { color: $primary; } &:hover { color: $on-primary; .icon { color: $on-primary; } } }
    &.danger { color: $danger; .icon { color: $danger; } &:hover { background: $danger; color: #fff; .icon { color: #fff; } } }
  }
  &__sep { height: 1px; background: $border; margin: 4px 6px; }
}
.drop-enter-active { transition: opacity .15s, transform .2s $ease-out; }
.drop-leave-active { transition: opacity .1s; }
.drop-enter-from { opacity: 0; transform: translateY(-4px) scale(.98); }
.drop-leave-to { opacity: 0; }

// ---------- Trạng thái ca ----------
.sync-pill {
  position: relative; display: grid; place-items: center; width: 34px; height: 34px; border-radius: 99px; color: $text-2; background: $fill; text-decoration: none;
  &.is-online { color: $success; background: $success-soft; }
  &.is-offline { color: $warning; background: $warning-soft; }
  &.is-connecting .icon { animation: pulse 1.4s infinite; }
  &__n { position: absolute; top: -4px; right: -4px; min-width: 16px; height: 16px; padding: 0 4px; border-radius: 99px; background: $warning; color: #fff; font-size: 10px; font-weight: 700; display: grid; place-items: center; }
}
.shift-pill {
  display: inline-flex; align-items: center; gap: 8px; height: 30px; padding: 0 12px; border-radius: 999px; border: 0; cursor: pointer;
  font: inherit; font-size: 13px; font-weight: 500; white-space: nowrap;
  &__dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
  &.is-open { background: $success-soft; color: $success; .shift-pill__dot { animation: pulse 2s infinite; } }
  &.is-closed { background: $warning-soft; color: $warning; }
}
@keyframes pulse { 0%, 100% { box-shadow: 0 0 0 0 tint($success, .5); } 50% { box-shadow: 0 0 0 4px tint($success, 0); } }

// ---------- Menu người dùng ----------
.user-menu { position: relative; }
.user-menu__btn {
  display: flex; align-items: center; gap: 8px; height: 40px; padding: 0 8px 0 4px; border: 0; border-radius: 999px;
  background: transparent; font: inherit; color: $text; cursor: pointer;
  &:hover { background: $fill; }
}
.user-menu__who { display: flex; flex-direction: column; line-height: 1.15; text-align: left; b { font-size: 13px; } small { font-size: 11px; color: $text-muted; } }
.avatar {
  width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; flex-shrink: 0;
  font-size: 12px; font-weight: 600; color: #fff; background: $primary;
}

.content { flex: 1; }
.is-full .content { flex: none; height: calc(100vh - #{$topbar-h}); min-height: 0; overflow: clip; }

// Biểu tượng nảy nhẹ khi được chọn
.nav-link.active .nav-link__icon, .hnav__link.active .icon, .tabbar__item.active .icon { animation: iconPop .45s $spring; }
@keyframes iconPop { 0% { transform: scale(.7); } 60% { transform: scale(1.15); } 100% { transform: scale(1); } }
.nav-link, .hnav__link { transition: background .2s $ease, color .2s; }
.dropdown { transform-origin: top right; }

// ---------- Toast (kiểu thông báo iOS, giữa phía trên) ----------
.toasts {
  position: fixed; top: calc(12px + var(--safe-top)); left: 50%; transform: translateX(-50%); z-index: 200;
  display: flex; flex-direction: column; align-items: center; gap: 8px; pointer-events: none;
}
.toast {
  display: flex; align-items: center; gap: 8px; padding: 10px 16px; border-radius: 999px;
  @include vibrancy(var(--menu-bg));
  box-shadow: $shadow-lg; font-weight: 500; color: $text; white-space: nowrap;
  .icon { color: $success; }
  &.error .icon { color: $danger; }
}
.toast-enter-active { transition: all .4s $spring; }
.toast-leave-active { transition: all .2s $ease; }
.toast-enter-from { opacity: 0; transform: translateY(-16px) scale(.95); }
.toast-leave-to { opacity: 0; transform: scale(.95); }

// ---------- Alert ----------
.alert-backdrop { align-items: center !important; }
.alert {
  width: 100%; max-width: 300px; padding: 22px 18px 16px; text-align: center; border-radius: 16px;
  @include vibrancy(var(--menu-bg)); box-shadow: $shadow-lg; animation: pop .25s $ease-out;
  h3 { font-size: 15px; }
  p { margin: 6px 0 18px; font-size: 13px; color: $text-2; }
  &__actions { display: flex; gap: 8px; .btn { flex: 1; } }
}

// ---------- Tab bar ----------
.tabbar { display: none; }
.more-sheet { max-width: 420px; }
.more-sheet__list { padding: 8px 12px calc(16px + var(--safe-bottom)); overflow-y: auto; -webkit-overflow-scrolling: touch; min-height: 0; }
.more-sheet__item {
  display: flex; align-items: center; gap: 12px; width: 100%; padding: 12px 8px; color: $text; font: inherit; font-size: 16px;
  border: 0; background: transparent; border-radius: 10px; cursor: pointer; text-align: left;
  & + & { border-top: 1px solid $border; border-radius: 0; }
  &:active { background: $fill; }
}
.more-sheet__icon { width: 32px; height: 32px; border-radius: 8px; display: grid; place-items: center; background: $primary-soft; color: $primary; }

@include tablet {
  .hide-tablet { display: none !important; }
  .sidebar { display: none; }
  .main { margin-left: 0; }
  .topbar { padding: 0 16px; gap: 10px; }
  .topbar__brand.only-mobile-flex { display: flex; }
  .topbar__title { display: none; }
  /* Thanh tab nổi kiểu "Liquid Glass" (iOS 26): viên nang kính mờ, có viên kính trượt theo tab đang chọn */
  .tabbar {
    display: block; position: fixed; left: 0; right: 0; bottom: 0; z-index: 60; pointer-events: none;
    padding: 0 14px calc(10px + var(--safe-bottom));
    // lớp mờ dần phía dưới để nội dung không "cắt ngang" thanh tab
    &::before { content: ''; position: absolute; inset: -24px 0 0; z-index: -1;
      background: linear-gradient(to bottom, transparent, color-mix(in srgb, var(--bg) 85%, transparent) 60%); }
    &__glass {
      position: relative; display: flex; height: 62px; max-width: 520px; margin: 0 auto; padding: 5px; border-radius: 999px; pointer-events: auto;
      background: color-mix(in srgb, var(--surface) 72%, transparent);
      backdrop-filter: saturate(190%) blur(24px); -webkit-backdrop-filter: saturate(190%) blur(24px);
      box-shadow:
        inset 0 .5px 0 rgba(255, 255, 255, .55),          // viền sáng phía trên như mặt kính
        inset 0 0 0 .5px color-mix(in srgb, var(--text) 10%, transparent),
        0 10px 30px -8px rgba(40, 24, 12, .28),
        0 2px 6px rgba(40, 24, 12, .08);
    }
    &__lens {
      position: absolute; top: 5px; bottom: 5px; left: 0; border-radius: 999px; // vị trí & bề rộng đo bằng JS theo tab đang chọn
      background: color-mix(in srgb, var(--primary) 13%, transparent);
      box-shadow: inset 0 0 0 .5px color-mix(in srgb, var(--primary) 18%, transparent), inset 0 1px 0 rgba(255, 255, 255, .35);
      transition: transform .45s $spring, opacity .2s;
      &.hidden { opacity: 0; }
    }
    &__item {
      position: relative; flex: 1 1 0; min-width: 0; padding: 0; margin: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;
      border: 0; background: transparent; border-radius: 999px; font: inherit; font-size: 10.5px; font-weight: 500; letter-spacing: -.01em;
      color: $text-2; cursor: pointer; -webkit-tap-highlight-color: transparent; transition: color .2s;
      span { max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 0 2px; }
      &.active { color: $primary; font-weight: 600; }
      .icon { transition: transform .25s $spring; }
      &:active .icon { transform: scale(.82); }
    }
  }
  [data-theme='espresso'] .tabbar__glass {
    box-shadow: inset 0 .5px 0 rgba(255, 255, 255, .12), inset 0 0 0 .5px rgba(255, 236, 214, .1), 0 10px 30px -8px rgba(0, 0, 0, .6);
  }
  [data-motion='off'] .tabbar__lens { transition: none; }
  .content { padding-bottom: calc(#{$tabbar-h} + var(--safe-bottom)); }
  .is-full .content { height: calc(100dvh - #{$topbar-h} - #{$tabbar-h} - var(--safe-bottom)); padding-bottom: 0; }
  .page { padding-bottom: 32px; }
}
@include mobile {
  .topbar { height: calc(#{$topbar-h} + var(--safe-top)); padding: var(--safe-top) 14px 0; }
  .is-full .content { height: calc(100dvh - #{$topbar-h} - var(--safe-top) - #{$tabbar-h} - var(--safe-bottom)); }
  .page { padding-bottom: 28px; }
}
</style>
