// Tự cập nhật app (PWA): khi có bản mới trên GitHub Pages thì tải về và tải lại trang ngay,
// không bắt người dùng phải tắt hẳn app rồi mở lại (iPhone hay giữ bản cũ rất lâu).
import { registerSW } from 'virtual:pwa-register'

export function installPwaUpdate() {
  if (!('serviceWorker' in navigator)) return
  registerSW({
    immediate: true,
    onRegisteredSW(url, reg) {
      if (!reg) return
      const check = () => { if (navigator.onLine !== false) reg.update().catch(() => {}) }
      // Mỗi lần mở lại app (từ nền lên) và mỗi 15 phút: hỏi xem có bản mới không
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check() })
      setInterval(check, 15 * 60 * 1000)
    },
  })
}
