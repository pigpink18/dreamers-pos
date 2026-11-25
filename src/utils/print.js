/**
 * IN PHIẾU RA MÁY IN NHIỆT (K80 / K58) hoặc giấy A4.
 * - Chỉ in đúng tờ phiếu (hoá đơn / chốt ca / tổng kết ngày), không in giao diện app hay hình nền.
 * - Nếu máy này đã kết nối thẳng máy in nhiệt (USB/Bluetooth/COM, xem utils/printerLink.js) thì in ngay
 *   bằng lệnh ESC/POS, không hiện hộp thoại in. Lỗi -> tự chuyển về hộp thoại in.
 * - Khổ giấy lấy từ Cài đặt › Cửa hàng › Máy in. Trang in dài đúng bằng phiếu để máy in nhiệt
 *   không đẩy giấy trắng thừa và không bị cắt sang trang 2.
 */
import { useSettings } from '../stores/settings'
import { useUi } from '../stores/ui'
import { DOTS, rasterize, toMono, buildJob } from './escpos'
import { printerDevice, ensureLink, sendRaw, link } from './printerLink'

/** Khổ giấy: bề rộng cuộn giấy và vùng in thực tế (đầu in nhiệt không in sát mép) */
export const PAPERS = {
  80: { label: 'K80 (80 mm)', page: 80, content: 72 },
  58: { label: 'K58 (58 mm)', page: 58, content: 48 },
  a4: { label: 'A4', page: 210, content: 190 },
}

const PX_PER_MM = 96 / 25.4

/** Tạo bản sao phiếu đặt ngoài app (#print-root) với đúng bề rộng khổ giấy */
function mountClone(src, paper, paperKey) {
  document.getElementById('print-root')?.remove()
  const root = document.createElement('div')
  root.id = 'print-root'
  root.style.setProperty('--print-w', paper.content + 'mm')
  root.dataset.paper = paperKey
  root.appendChild(src.cloneNode(true))
  document.body.appendChild(root)
  return root
}

/** Chờ ảnh (mã QR) trong phiếu sẵn sàng */
const imagesReady = (root) => Promise.all([...root.querySelectorAll('img')].filter((i) => !i.complete)
  .map((i) => new Promise((r) => { i.onload = i.onerror = r })))

/** In phiếu đang mở. el: phần tử .print-area (bỏ trống = phiếu trong cửa sổ đang mở trên cùng) */
export function printReceipt(el) {
  const src = el || [...document.querySelectorAll('.print-area')].filter((e) => e.offsetParent !== null).pop()
  if (!src) return window.print()
  const paperKey = String(useSettings().printer?.paper || 80)
  const dev = printerDevice().value
  // Máy này đã kết nối thẳng máy in nhiệt (USB/Bluetooth/COM) -> in ngay, không hiện hộp thoại
  if (dev.mode !== 'system' && DOTS[paperKey]) return printDirect(src, paperKey, dev)
  return printDialog(src, paperKey)
}

async function printDirect(src, paperKey, dev) {
  const ui = useUi()
  if (link.busy) return
  link.busy = true
  let root
  try {
    await ensureLink() // kết nối trước (Bluetooth có thể cần chọn lại máy ngay khi bấm)
    root = mountClone(src, PAPERS[paperKey], paperKey)
    root.dataset.raster = ''
    await imagesReady(root)
    const canvas = await rasterize(root.firstElementChild, DOTS[paperKey])
    await sendRaw(buildJob(toMono(canvas), { cut: dev.cut !== false }))
    ui.toast('Đã gửi phiếu tới máy in')
  } catch (e) {
    console.warn('In trực tiếp lỗi', e)
    if (e?.name === 'NotFoundError' && /cancel/i.test(e.message)) return // người dùng huỷ hộp chọn máy in
    ui.toast(`Không in được qua ${dev.label || 'máy in'}: ${e?.message || e}. Chuyển sang hộp thoại in.`, 'error')
    printDialog(src, paperKey)
  } finally {
    if (root && document.getElementById('print-root') === root && !document.documentElement.classList.contains('printing')) root.remove()
    link.busy = false
  }
}

/** In qua hộp thoại in của trình duyệt (mọi máy in, kể cả iPhone) */
function printDialog(src, paperKey) {
  const paper = PAPERS[paperKey] || PAPERS[80]
  const root = mountClone(src, paper, paperKey)

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
  imagesReady(root).then(() => {
    requestAnimationFrame(() => {
      window.print()
      // Một số trình duyệt (iPhone) không báo "afterprint": dọn khi quay lại app
      setTimeout(() => window.addEventListener('focus', cleanup, { once: true }), 500)
      setTimeout(cleanup, 60000)
    })
  })
}
