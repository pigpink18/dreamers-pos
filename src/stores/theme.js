import { defineStore } from 'pinia'
import { watchEffect } from 'vue'
import { useStorage } from '../utils/storage'

/** Danh sách theme — màu thật nằm trong src/styles/_themes.scss */
export const THEMES = {
  latte: { name: 'Latte', desc: 'Kem sữa & nâu cà phê', swatch: ['#f6f1eb', '#fffdfa', '#7b4a26'] },
  espresso: { name: 'Espresso', desc: 'Tối, sang, chữ màu kem', swatch: ['#15100c', '#211912', '#d6a26f'] },
  classic: { name: 'Classic', desc: 'Xám Apple & indigo', swatch: ['#f5f5f7', '#ffffff', '#4f46e5'] },
}
export const MOTIONS = {
  full: { name: 'Đầy đủ', desc: 'Chuyển trang trượt, gợn sóng khi bấm, số đếm chạy' },
  reduced: { name: 'Nhẹ', desc: 'Chỉ mờ dần, không trượt — dễ chịu với người say chuyển động' },
  off: { name: 'Tắt', desc: 'Không hiệu ứng, nhanh nhất cho máy cấu hình thấp' },
}
export const LAYOUTS = {
  vertical: { name: 'Menu dọc', desc: 'Thanh menu bên trái (như Finder, Mail)' },
  horizontal: { name: 'Menu ngang', desc: 'Thanh menu phía trên, rộng chỗ cho nội dung' },
}

/** Giao diện lưu theo từng máy (mỗi quầy có thể chọn khác nhau) */
export const useAppearance = defineStore('appearance', () => {
  const osReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const prefs = useStorage('appearance', { theme: 'latte', layout: 'vertical', motion: osReduced ? 'reduced' : 'full' })
  if (!prefs.value.motion) prefs.value.motion = osReduced ? 'reduced' : 'full'

  watchEffect(() => {
    const t = THEMES[prefs.value.theme] ? prefs.value.theme : 'latte'
    document.documentElement.dataset.theme = t
    document.documentElement.dataset.motion = prefs.value.motion || 'full'
    const bg = { latte: '#f6f1eb', espresso: '#15100c', classic: '#f5f5f7' }[t]
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg)
  })

  return { prefs }
})
