/**
 * IN PHIẾU RA MÁY IN NHIỆT (K80 / K58) hoặc giấy A4.
 * - Chỉ in đúng tờ phiếu (hoá đơn / chốt ca / tổng kết ngày), không in giao diện app hay hình nền.
 * - Khổ giấy lấy từ Cài đặt › Cửa hàng › Máy in. Trang in dài đúng bằng phiếu để máy in nhiệt
 *   không đẩy giấy trắng thừa và không bị cắt sang trang 2.
 */
import { useSettings } from '../stores/settings'

/** Khổ giấy: bề rộng cuộn giấy và vùng in thực tế (đầu in nhiệt không in sát mép) */
export const PAPERS = {
  80: { label: 'K80 (80 mm)', page: 80, content: 72 },
  58: { label: 'K58 (58 mm)', page: 58, content: 48 },
  a4: { label: 'A4', page: 210, content: 190 },
}

const PX_PER_MM = 96 / 25.4

/** In phiếu đang mở. el: phần tử .print-area (bỏ trống = phiếu trong cửa sổ đang mở trên cùng) */
export function printReceipt(el) {
  const src = el || [...document.querySelectorAll('.print-area')].filter((e) => e.offsetParent !== null).pop()
  if (!src) return window.print()
  const paper = PAPERS[useSettings().printer?.paper] || PAPERS[80]

  // Bản sao của phiếu, đặt ngoài app: khi in chỉ còn mỗi nó
  document.getElementById('print-root')?.remove()
  const root = document.createElement('div')
  root.id = 'print-root'
  root.style.setProperty('--print-w', paper.content + 'mm')
  root.dataset.paper = String(useSettings().printer?.paper || 80)
  root.appendChild(src.cloneNode(true))
  document.body.appendChild(root)

  // Đo chiều dài phiếu (đúng bề rộng in) -> đặt khổ trang dài vừa đủ
  const heightMm = Math.ceil(root.scrollHeight / PX_PER_MM) + 6
  const style = document.createElement('style')
  style.id = 'print-page'
  style.textContent = paper.page === 210
    ? '@page { size: A4; margin: 12mm 10mm; }'
    : `@page { size: ${paper.page}mm ${Math.max(heightMm, 40)}mm; margin: 0; }`
  document.getElementById('print-page')?.remove()
  document.head.appendChild(style)
  document.documentElement.classList.add('printing')

  let cleaned = false
  const cleanup = () => {
    if (cleaned) return
    cleaned = true
    root.remove()
    style.remove()
    document.documentElement.classList.remove('printing')
    window.removeEventListener('afterprint', cleanup)
  }
  window.addEventListener('afterprint', cleanup)
  // Chờ ảnh (mã QR) trong phiếu sẵn sàng rồi mới in
  const imgs = [...root.querySelectorAll('img')].filter((i) => !i.complete)
  Promise.all(imgs.map((i) => new Promise((r) => { i.onload = i.onerror = r }))).then(() => {
    requestAnimationFrame(() => {
      window.print()
      // Một số trình duyệt (iPhone) không báo "afterprint": dọn khi quay lại app
      setTimeout(() => window.addEventListener('focus', cleanup, { once: true }), 500)
      setTimeout(cleanup, 60000)
    })
  })
}
