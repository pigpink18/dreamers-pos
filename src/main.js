import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { hasData, clearAll } from './utils/storage'
import { seedDemo, seedFresh } from './stores/seed'
import { useAppearance } from './stores/theme'
import { installRipple } from './utils/motion'
import './assets/font-awesome-6-pro/css/fontawesome.min.css'
import './assets/font-awesome-6-pro/css/light.min.css'
// CSS thư viện phải nạp TRƯỚC main.scss để giao diện của mình ghi đè được
import '@vuepic/vue-datepicker/dist/main.css'
import 'vue-multiselect/dist/vue-multiselect.css'
import './styles/main.scss'

const app = createApp(App)
app.use(createPinia())
useAppearance() // áp theme Latte / Espresso / Classic

// ---- Dữ liệu lần đầu ----
// DATA_VERSION đổi -> mọi máy xoá sạch dữ liệu cũ một lần và bắt đầu như app mới.
// App mới chỉ có 2 tài khoản Yến / Lam. Muốn xem thử với số liệu mẫu: Cài đặt -> Dữ liệu -> Nạp dữ liệu mẫu.
const DATA_VERSION = '2'
const wantDemo = localStorage.getItem('dreamers:wantDemo') === '1'
if (localStorage.getItem('dreamers:dataVersion') !== DATA_VERSION) {
  clearAll(['appearance'])
  localStorage.setItem('dreamers:dataVersion', DATA_VERSION)
}
if (wantDemo) { clearAll(['appearance', 'dataVersion']); seedDemo() }
else if (!hasData()) seedFresh()

// Router cài sau khi có dữ liệu để kiểm tra đăng nhập chính xác
app.use(router)
installRipple() // gợn sóng khi bấm
app.mount('#app')
// Đồng bộ lịch Booking.com / Airbnb định kỳ (nếu đã dán link iCal)
import('./channels/ical').then((m) => m.startAutoSync())
// Đã kết nối máy chủ -> tự đồng bộ với các máy khác (thư viện Supabase chỉ tải khi cần)
if (localStorage.getItem('dreamers:sync:config')) import('./sync/connection').then((m) => m.autoStart())
