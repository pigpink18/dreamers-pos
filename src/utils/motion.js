/**
 * HIỆU ỨNG CHUYỂN ĐỘNG dùng chung
 *  - installRipple(): gợn sóng khi bấm vào nút, thẻ, menu (kiểu Material nhưng mềm như iOS)
 *  - flyTo(fromEl | {x,y}, toEl): chấm bay từ món hàng vào giỏ
 *  - useCountUp(): số chạy từ 0 tới giá trị thật
 * Tất cả tự tắt khi Cài đặt › Giao diện › Hiệu ứng = Nhẹ/Tắt.
 */
import { ref, watch, onMounted } from 'vue'

export const motionLevel = () => document.documentElement.dataset.motion || 'full'
const full = () => motionLevel() === 'full'

// ---------------- Gợn sóng khi bấm ----------------
const RIPPLE_TARGETS = [
  '.btn', '.chip', '.pcard', '.nav-link', '.hnav__link', '.tabbar__item', '.user-tile', '.sf', '.theme-card',
  '.segmented button', '.dropdown__item', '.more-sheet__item', '.role-item', '.settings__tabs button',
  '.pinpad__keys button', '.room', '.tl-cell', '.tab', '.stepper button',
].join(',')

export function installRipple() {
  document.addEventListener('pointerdown', (e) => {
    if (!full() || e.button !== 0) return
    const el = e.target.closest(RIPPLE_TARGETS)
    if (!el || el.disabled || el.closest('[data-no-ripple]')) return
    const r = el.getBoundingClientRect()
    const size = Math.max(r.width, r.height) * 2.2
    const dot = document.createElement('span')
    dot.className = 'ripple'
    dot.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`
    // phần tử cần position + overflow để chứa gợn sóng
    const cs = getComputedStyle(el)
    if (cs.position === 'static') el.style.position = 'relative'
    if (cs.overflow === 'visible' && el.tagName !== 'TR') el.style.overflow = 'hidden'
    el.appendChild(dot)
    dot.addEventListener('animationend', () => dot.remove())
  }, { passive: true })
}

// ---------------- Bay vào giỏ hàng ----------------
export function flyTo(from, toEl, { color = 'var(--primary)', size = 18 } = {}) {
  if (!full() || !toEl) return
  const a = from instanceof Element ? from.getBoundingClientRect() : { left: from.x, top: from.y, width: 0, height: 0 }
  const b = toEl.getBoundingClientRect()
  if (!b.width) return
  const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2
  const x1 = b.left + b.width / 2, y1 = b.top + Math.min(b.height / 2, 40)
  const dot = document.createElement('div')
  dot.className = 'fly-dot'
  dot.style.cssText = `width:${size}px;height:${size}px;left:${x0 - size / 2}px;top:${y0 - size / 2}px;background:${color}`
  document.body.appendChild(dot)
  const dx = x1 - x0, dy = y1 - y0
  dot.animate(
    [
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 120}px) scale(1.15)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${dx}px, ${dy}px) scale(.35)`, opacity: 0.4 },
    ],
    { duration: 620, easing: 'cubic-bezier(.45,.05,.55,.95)' }
  ).onfinish = () => {
    dot.remove()
    toEl.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.04)' }, { transform: 'scale(1)' }], { duration: 260, easing: 'ease-out' })
  }
}

// ---------------- Số chạy (count-up) ----------------
/** Nhận chuỗi đã định dạng ("1.234.000 ₫", "43%") và cho các chữ số chạy từ 0 lên */
export function useCountUp(source, duration = 700) {
  const out = ref(source())
  const run = (target) => {
    const m = String(target).match(/^(.*?)(-?[\d.]+)(.*)$/)
    if (!full() || !m) return (out.value = target)
    const [, pre, numStr, post] = m
    const end = Number(numStr.replace(/\./g, ''))
    if (!isFinite(end) || Math.abs(end) < 1) return (out.value = target)
    const fmt = new Intl.NumberFormat('vi-VN')
    const t0 = performance.now()
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      out.value = p < 1 ? pre + fmt.format(Math.round(end * eased)) + post : target
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }
  onMounted(() => run(source()))
  watch(source, (v) => run(v))
  return out
}
