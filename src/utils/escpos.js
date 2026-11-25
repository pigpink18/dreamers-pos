/**
 * Chuyển phiếu (HTML) thành lệnh ESC/POS cho máy in nhiệt.
 * In dạng ẢNH (raster) thay vì chữ: máy in nhiệt Trung Quốc/Epson hầu như không có bảng mã tiếng Việt,
 * in ảnh thì giữ nguyên dấu, font, đường kẻ và mã QR giống hệt bản xem trước.
 */

/** Số điểm in trên một dòng (đầu in 203 dpi = 8 điểm/mm) */
export const DOTS = { 80: 576, 58: 384 }

// Ma trận Bayer 4x4: vùng xám (dấu "ĐÃ HUỶ" mờ...) in thành chấm lưới, chữ đen vẫn nét
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]
const BLACK = 110 // tối hơn mức này -> luôn in đen
const WHITE = 205 // sáng hơn mức này -> luôn để trắng

let fontCss = null // nhúng font 1 lần mỗi phiên cho nhanh

/** Chụp phần tử thành canvas đúng bề rộng `dots` điểm */
export async function rasterize(el, dots) {
  const { toCanvas, getFontEmbedCSS } = await import('html-to-image')
  if (fontCss === null) {
    try { fontCss = await getFontEmbedCSS(el) } catch { fontCss = '' }
  }
  const w = el.getBoundingClientRect().width || el.offsetWidth
  const opts = { pixelRatio: dots / w, backgroundColor: '#ffffff', cacheBust: false }
  const src = await toCanvas(el, fontCss ? { ...opts, fontEmbedCSS: fontCss } : { ...opts, skipFonts: true })
  // Vẽ lại vào canvas đúng `dots` (làm tròn pixelRatio có thể lệch 1-2 điểm)
  const h = Math.round(src.height * (dots / src.width))
  const out = document.createElement('canvas')
  out.width = dots
  out.height = h
  const ctx = out.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, dots, h)
  ctx.drawImage(src, 0, 0, dots, h)
  return out
}

/** Canvas -> ảnh 1 bit (1 = chấm đen), mỗi byte 8 điểm theo chiều ngang */
export function toMono(canvas) {
  const { width: w, height: h } = canvas
  const px = canvas.getContext('2d').getImageData(0, 0, w, h).data
  const bpr = Math.ceil(w / 8)
  const bits = new Uint8Array(bpr * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const a = px[i + 3] / 255
      const lum = 255 - a * (255 - (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]))
      const t = BLACK + ((BAYER[y & 3][x & 3] + 0.5) / 16) * (WHITE - BLACK)
      if (lum < t) bits[y * bpr + (x >> 3)] |= 0x80 >> (x & 7)
    }
  }
  // Bỏ dòng trắng thừa ở cuối cho đỡ tốn giấy
  let last = h
  while (last > 0 && bits.subarray((last - 1) * bpr, last * bpr).every((b) => b === 0)) last--
  return { bits: bits.subarray(0, last * bpr), bpr, height: last }
}

/** Ghép lệnh ESC/POS: khởi tạo -> ảnh (chia dải) -> đẩy giấy -> cắt */
export function buildJob({ bits, bpr, height }, { cut = true, feed = 4 } = {}) {
  const parts = [Uint8Array.of(0x1b, 0x40)] // ESC @ — khởi tạo máy in
  const BAND = 96 // in từng dải để không tràn bộ đệm của máy in rẻ tiền
  for (let y = 0; y < height; y += BAND) {
    const rows = Math.min(BAND, height - y)
    // GS v 0 m xL xH yL yH — in ảnh raster
    parts.push(Uint8Array.of(0x1d, 0x76, 0x30, 0, bpr & 0xff, bpr >> 8, rows & 0xff, rows >> 8))
    parts.push(bits.subarray(y * bpr, (y + rows) * bpr))
  }
  parts.push(Uint8Array.of(0x1b, 0x64, feed)) // ESC d n — đẩy giấy n dòng
  if (cut) parts.push(Uint8Array.of(0x1d, 0x56, 0x42, 0)) // GS V 66 0 — đẩy tới dao rồi cắt
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0))
  let o = 0
  for (const p of parts) { out.set(p, o); o += p.length }
  return out
}
