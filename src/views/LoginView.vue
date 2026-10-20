<script setup>
/**
 * MÀN HÌNH ĐĂNG NHẬP / KHOÁ — kiểu màn hình khoá iPad ở quầy:
 * chọn người → nhập PIN. Lần đầu (chưa có tài khoản) → tạo tài khoản Chủ quán.
 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PinPad from '../components/auth/PinPad.vue'
import Icon from '../components/ui/Icon.vue'
import { useAuth, initials } from '../stores/auth'
import { useSettings } from '../stores/settings'
import { useShifts } from '../stores/shifts'
import { useUi } from '../stores/ui'
import { firstAllowedPath } from '../router'
import logo from '../assets/image/logo.png'

const auth = useAuth()
const settings = useSettings()
const shifts = useShifts()
const ui = useUi()
const route = useRoute()
const router = useRouter()

// Đồng hồ lớn như màn hình khoá
const now = ref(new Date())
let timer
onMounted(() => (timer = setInterval(() => (now.value = new Date()), 1000 * 15)))
onBeforeUnmount(() => clearInterval(timer))
const time = computed(() => now.value.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }))
const date = computed(() => now.value.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' }))
const greeting = computed(() => {
  const h = now.value.getHours()
  return h < 11 ? 'Chào buổi sáng ☕' : h < 14 ? 'Chào buổi trưa' : h < 18 ? 'Chào buổi chiều' : 'Chào buổi tối'
})

// Đang khoá -> chọn sẵn người vừa dùng
const selectedId = ref(auth.isLocked ? auth.session?.userId : null)
const selected = computed(() => auth.userById(selectedId.value))
const pad = ref(null)

function onPin(pin) {
  if (!auth.login(selectedId.value, pin)) {
    pad.value?.shake()
    return
  }
  const to = route.query.redirect && route.query.redirect !== '/login' ? route.query.redirect : firstAllowedPath()
  router.replace(to)
}

// ---- Lần đầu: tạo Chủ quán ----
const setup = ref({ name: '', pin: '', pin2: '' })
function createOwner() {
  const s = setup.value
  if (!s.name.trim()) return ui.toast('Nhập tên của bạn', 'error')
  if (!/^\d{6}$/.test(s.pin)) return ui.toast('PIN gồm đúng 6 chữ số', 'error')
  if (s.pin !== s.pin2) return ui.toast('Hai lần nhập PIN không khớp', 'error')
  auth.setupOwner({ name: s.name.trim(), pin: s.pin })
  router.replace('/')
}

const roleColor = (u) => auth.roleById(u.roleId)?.color || '#888'
</script>

<template>
  <div class="login">
    <!-- Cột thương hiệu -->
    <aside class="login__brand">
      <img :src="logo" alt="Dreamers Home & Coffee" class="login__logo" />
      <div class="login__clock">
        <div class="login__time num">{{ time }}</div>
        <div class="login__date">{{ date }}</div>
      </div>
      <div class="login__shift">
        <template v-if="shifts.current"><Icon name="fa-cash-register" :size="14" /> Ca {{ shifts.current.code }} đang mở · {{ shifts.current.userName }}</template>
        <template v-else><Icon name="fa-cash-register" :size="14" /> Chưa mở ca</template>
      </div>
    </aside>

    <!-- Cột đăng nhập -->
    <main class="login__panel">
      <!-- Chưa có tài khoản nào -->
      <form v-if="!auth.activeUsers.length" class="login__setup" @submit.prevent="createOwner">
        <h1>Chào mừng đến Dreamers</h1>
        <p class="muted">Tạo tài khoản Chủ quán để bắt đầu. Sau đó bạn có thể thêm nhân viên trong Cài đặt.</p>
        <div class="field"><label>Tên của bạn</label><input class="input" v-model="setup.name" autofocus /></div>
        <div class="field"><label>Mã PIN (6 số)</label><input class="input num" v-model="setup.pin" inputmode="numeric" maxlength="6" type="password" /></div>
        <div class="field"><label>Nhập lại PIN</label><input class="input num" v-model="setup.pin2" inputmode="numeric" maxlength="6" type="password" /></div>
        <button class="btn btn--primary btn--lg btn--block">Tạo tài khoản & bắt đầu</button>
      </form>

      <!-- Nhập PIN -->
      <div v-else-if="selected" class="login__pin">
        <div class="avatar-xl" :style="{ background: roleColor(selected) }">{{ initials(selected.name) }}</div>
        <h2>{{ auth.isLocked && auth.session?.userId === selected.id ? 'Màn hình đã khoá' : selected.name }}</h2>
        <p class="muted">{{ auth.isLocked && auth.session?.userId === selected.id ? `${selected.name} · nhập PIN để mở` : `${auth.roleById(selected.roleId)?.name} · nhập mã PIN` }}</p>
        <PinPad ref="pad" @complete="onPin" />
        <button class="btn btn--plain" @click="selectedId = null"><Icon name="fa-arrow-right-arrow-left" :size="14" /> Đổi người dùng</button>
      </div>

      <!-- Chọn người -->
      <div v-else class="login__users">
        <h1>{{ greeting }}</h1>
        <p class="muted">Chọn tên của bạn để vào ca</p>
        <div class="user-grid">
          <button v-for="u in auth.activeUsers" :key="u.id" class="user-tile" @click="selectedId = u.id">
            <span class="avatar-lg" :style="{ background: roleColor(u) }">{{ initials(u.name) }}</span>
            <b>{{ u.name }}</b>
            <small>{{ auth.roleById(u.roleId)?.name }}</small>
          </button>
        </div>
      </div>
    </main>
  </div>
</template>

<style lang="scss">
@use '../styles/tokens' as *;

.login {
  min-height: 100vh; min-height: 100dvh; display: grid; grid-template-columns: minmax(320px, 42%) 1fr;
  &__brand {
    position: relative; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between; padding: 48px;
    color: #f4e9dd;
    background:
      radial-gradient(120% 80% at 0% 0%, rgba(214, 162, 111, .35), transparent 60%),
      radial-gradient(90% 70% at 100% 100%, rgba(123, 74, 38, .55), transparent 60%),
      linear-gradient(160deg, #3b2617, #1d130c);
    // vân hạt cà phê rất mờ
    &::after {
      content: ''; position: absolute; inset: 0; opacity: .07; pointer-events: none;
      background-image: radial-gradient(ellipse 7px 10px at 50% 50%, #f4e9dd 60%, transparent 62%);
      background-size: 46px 46px; transform: rotate(-20deg) scale(1.4);
    }
  }
  &__logo { width: 150px; filter: invert(1) sepia(.35) saturate(1.2) brightness(1.05); position: relative; z-index: 1; }
  &__clock { position: relative; z-index: 1; }
  &__time { font: 200 96px/1 $font-display; letter-spacing: -0.04em; }
  &__date { font-size: 18px; opacity: .8; margin-top: 8px; text-transform: capitalize; }
  &__shift { position: relative; z-index: 1; display: inline-flex; align-items: center; gap: 8px; font-size: 13px; opacity: .85;
    padding: 8px 14px; border-radius: 999px; background: rgba(255, 255, 255, .08); align-self: flex-start; }

  &__panel { display: flex; align-items: center; justify-content: center; padding: 40px 24px; background: $bg; }
  &__users { width: 100%; max-width: 620px; text-align: center; h1 { font-size: 30px; } > p { margin: 6px 0 28px; } }
  &__pin { display: flex; flex-direction: column; align-items: center; gap: 6px; h2 { font-size: 22px; margin-top: 10px; } > p { margin: 0 0 22px; } .btn--plain { margin-top: 18px; } }
  &__setup { width: 100%; max-width: 380px; display: flex; flex-direction: column; gap: 14px; h1 { font-size: 26px; } p { margin: 0 0 6px; } }
  &__hint { display: inline-flex; gap: 8px; align-items: center; margin-top: 26px; font-size: 13px; color: $text-muted; }
}
.user-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 14px; }
.user-tile {
  display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 20px 10px 16px; border: 0; border-radius: 20px;
  background: $surface; box-shadow: $shadow; cursor: pointer; font: inherit; color: $text;
  transition: transform .25s $spring, box-shadow .2s;
  &:hover { transform: translateY(-3px); box-shadow: $shadow-lg; }
  &:active { transform: scale(.96); }
  b { margin-top: 8px; font-size: 15px; }
  small { color: $text-muted; font-size: 12px; }
  &__demo { margin-top: 4px; padding: 1px 8px; border-radius: 6px; background: $fill; font-variant-numeric: tabular-nums; }
}
.avatar-lg, .avatar-xl {
  display: grid; place-items: center; border-radius: 50%; color: #fff; font-weight: 600; letter-spacing: .02em;
  box-shadow: inset 0 0 0 3px rgba(255, 255, 255, .25);
}
.avatar-lg { width: 64px; height: 64px; font-size: 22px; }
.avatar-xl { width: 84px; height: 84px; font-size: 30px; }

@include tablet {
  .login { grid-template-columns: 1fr; grid-template-rows: auto 1fr; }
  .login__brand { padding: calc(20px + var(--safe-top)) 24px 20px; flex-direction: row; align-items: center; gap: 16px; }
  .login__logo { width: 64px; }
  .login__clock { margin-left: auto; text-align: right; }
  .login__time { font-size: 40px; }
  .login__date { font-size: 13px; margin-top: 2px; }
  .login__shift { display: none; }
}
@include mobile {
  .user-grid { grid-template-columns: repeat(2, 1fr); }
  .login__panel { align-items: flex-start; padding: 20px 16px calc(16px + var(--safe-bottom)); }
  .login__pin { gap: 2px; h2 { font-size: 19px; margin-top: 6px; } > p { margin-bottom: 14px; } .btn--plain { margin-top: 8px; } }
  .avatar-xl { width: 64px; height: 64px; font-size: 24px; }
}
</style>
