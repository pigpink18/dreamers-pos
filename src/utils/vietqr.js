/**
 * VIETQR (chuẩn NAPAS 247 / EMVCo) — tạo mã QR chuyển khoản ngay trên máy, không cần internet.
 * Mọi app ngân hàng ở Việt Nam quét được, tự điền sẵn số tài khoản, số tiền và nội dung.
 */
import QRCode from 'qrcode'

// Mã BIN ngân hàng (theo NAPAS). Thiếu ngân hàng nào thì thêm 1 dòng.
export const BANKS = [
  { bin: '970436', code: 'VCB', name: 'Vietcombank' },
  { bin: '970407', code: 'TCB', name: 'Techcombank' },
  { bin: '970422', code: 'MB', name: 'MB Bank' },
  { bin: '970416', code: 'ACB', name: 'ACB' },
  { bin: '970418', code: 'BIDV', name: 'BIDV' },
  { bin: '970405', code: 'VBA', name: 'Agribank' },
  { bin: '970415', code: 'ICB', name: 'VietinBank' },
  { bin: '970423', code: 'TPB', name: 'TPBank' },
  { bin: '970432', code: 'VPB', name: 'VPBank' },
  { bin: '970403', code: 'STB', name: 'Sacombank' },
  { bin: '970443', code: 'SHB', name: 'SHB' },
  { bin: '970437', code: 'HDB', name: 'HDBank' },
  { bin: '970448', code: 'OCB', name: 'OCB' },
  { bin: '970426', code: 'MSB', name: 'MSB' },
  { bin: '970441', code: 'VIB', name: 'VIB' },
]
export const bankByBin = (bin) => BANKS.find((b) => b.bin === bin)

// Một trường EMVCo: ID (2 số) + độ dài (2 số) + giá trị
const f = (id, value) => id + String(value.length).padStart(2, '0') + value

// CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF)
export function crc16(str) {
  let crc = 0xffff
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

/** Bỏ dấu tiếng Việt + ký tự lạ — nhiều ngân hàng chỉ nhận nội dung không dấu */
export const plainText = (s = '') =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^a-zA-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

/**
 * Chuỗi dữ liệu VietQR
 * @param {{ bin: string, account: string, amount?: number, note?: string }} p
 */
export function vietQrPayload({ bin, account, amount, note }) {
  const merchant = f('00', 'A000000727') + f('01', f('00', bin) + f('01', String(account).replace(/\s/g, ''))) + f('02', 'QRIBFTTA')
  let s = f('00', '01') + f('01', amount ? '12' : '11') + f('38', merchant) + f('53', '704')
  if (amount) s += f('54', String(Math.round(amount)))
  s += f('58', 'VN')
  const purpose = plainText(note).slice(0, 25)
  if (purpose) s += f('62', f('08', purpose))
  s += '6304'
  return s + crc16(s)
}

/** Ảnh QR dạng data URL (SVG) để gắn vào <img> */
export async function vietQrImage(p, size = 240) {
  const svg = await QRCode.toString(vietQrPayload(p), { type: 'svg', errorCorrectionLevel: 'M', margin: 1, width: size, color: { dark: '#000000', light: '#ffffff' } })
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}
