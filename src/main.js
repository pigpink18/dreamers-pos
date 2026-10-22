import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { hasData, clearAll, markSeeded } from './utils/storage'
import { seedDemo, seedFresh, seedBlankShop, ensureMenu, ensureRooms, viRoomTypes } from './stores/seed'
import { useAppearance } from './stores/theme'
import { useAllStores } from './stores/all'
import { installRipple } from './utils/motion'
import { installPwaUpdate } from './utils/pwaUpdate'
import { isLegacy, nsKey, platformConfigured } from './tenant'
import { boot } from './boot'
import './assets/font-awesome-6-pro/css/fontawesome.min.css'
import './assets/font-awesome-6-pro/css/light.min.css'
// CSS thư viện phải nạp TRƯỚC main.scss để giao diện của mình ghi đè được
import '@vuepic/vue-datepicker/dist/main.css'
import 'vue-multiselect/dist/vue-multiselect.css'
import './styles/main.scss'

installPwaUpdate() // có bản mới thì tự cập nhật

const app = createApp(App)
app.use(createPinia())
useAppearance() // áp theme Latte / Espresso / Classic

/** Chế độ 1 máy (chưa có hệ thống nhiều quán): giữ nguyên cách chạy cũ của Dreamers */
function bootLegacy() {
  // DATA_VERSION đổi -> mọi máy xoá sạch dữ liệu cũ một lần và bắt đầu như app mới.
  const DATA_VERSION = '2'
  const wantDemo = localStorage.getItem(nsKey('wantDemo')) === '1'
  if (localStorage.getItem(nsKey('dataVersion')) !== DATA_VERSION) {
    clearAll(['appearance'])
    localStorage.setItem(nsKey('dataVersion'), DATA_VERSION)
  }
  if (wantDemo) { clearAll(['appearance', 'dataVersion']); seedDemo() }
  else if (!hasData()) seedFresh()
  else { ensureMenu(); ensureRooms(); viRoomTypes() } // bổ sung món còn thiếu trong menu (mỗi phiên bản menu chạy 1 lần)
}

/** Mở 1 quán trên hệ thống: trả về cách đồng bộ ('push' | 'resume' | null) */
async function bootShop() {
  useAllStores() // mọi bộ dữ liệu phải sẵn sàng trước khi đồng bộ (gửi lên / tải về đủ cả menu, phòng, hoá đơn…)
  let init = null
  try { init = JSON.parse(localStorage.getItem(nsKey('init'))) } catch { /* bỏ qua */ }
  if (init) {
    // Quán vừa tạo trên máy này: quán trống (chủ quán + PIN) hoặc dữ liệu cũ đã chép sang lúc tạo
    if (!init.importLegacy) seedBlankShop(init)
    else markSeeded()
    localStorage.removeItem(nsKey('init'))
    return 'push'
  }
  if (hasData()) return 'resume'
  // Máy mới vào quán đã có: tải dữ liệu quán từ máy chủ trước khi cho đăng nhập PIN
  const conn = await import('./sync/connection')
  if (!(await conn.getSession())) { boot.state = 'needSession'; return null }
  try {
    await Promise.race([conn.startSync('pull'), new Promise((_, rej) => setTimeout(() => rej(new Error('Máy chủ phản hồi quá lâu')), 25000))])
  } catch (e) {
    const m = e?.message || String(e)
    boot.state = 'error'
    boot.error = /fetch|network|load failed|quá lâu/i.test(m) ? 'không kết nối được máy chủ' : m
    return null
  }
  // Quán chưa có dữ liệu trên máy chủ (VD tạo quán xong bị mất mạng): màn PIN sẽ cho tạo chủ quán, đồng bộ tự gửi lên
  markSeeded()
  return 'started'
}

;(async () => {
  let syncMode = null
  if (isLegacy) {
    // Đã cài máy chủ nhưng máy chưa chọn quán: không tự tạo dữ liệu Dreamers trên máy của quán khác
    if (!platformConfigured()) bootLegacy()
    else if (hasData()) { ensureMenu(); ensureRooms(); viRoomTypes() }
  } else {
    syncMode = await bootShop()
  }

  // Router cài sau khi có dữ liệu để kiểm tra đăng nhập chính xác
  app.use(router)
  installRipple() // gợn sóng khi bấm
  app.mount('#app')

  // Đồng bộ lịch Booking.com / Airbnb định kỳ (nếu đã dán link iCal)
  import('./channels/ical').then((m) => m.startAutoSync())
  // Quán trên hệ thống -> đồng bộ với máy chủ (thư viện Supabase chỉ tải khi cần)
  if (syncMode === 'push') import('./sync/connection').then((m) => m.startSync('push').catch(() => {}))
  else if (syncMode === 'resume') import('./sync/connection').then((m) => m.autoStart())
})()
