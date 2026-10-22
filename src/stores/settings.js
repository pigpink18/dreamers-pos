import { defineStore } from 'pinia'
import { useStorage } from '../utils/storage'
import { isLegacy, activeShop, nsKey } from '../tenant'

/** Thông tin mặc định của Dreamers (chế độ 1 máy cũ) — dùng khi đưa dữ liệu Dreamers lên hệ thống */
export const LEGACY_SHOP = {
  name: 'Dreamers Home & Coffee',
  address: '19B Đặng Thái Thân, Phường 3, TP. Đà Lạt, Lâm Đồng',
  phone: '(+84) 865 665 603',
  footer: 'Cảm ơn quý khách — hẹn gặp lại tại Dreamers!',
}
export const LEGACY_PAYMENT = { bin: '970422', account: '0865665603', holder: '', qrOnReceipt: true }

export const useSettings = defineStore('settings', () => {
  // Quán Dreamers (chế độ 1 máy cũ) giữ thông tin sẵn có; quán mới trên hệ thống bắt đầu trống
  const shop = useStorage('shop', isLegacy
    ? { ...LEGACY_SHOP }
    : { name: activeShop?.name || '', address: '', phone: '', footer: 'Cảm ơn quý khách — hẹn gặp lại!' })
  const counters = useStorage('counters', { HD: 0, DP: 0, PN: 0, KH: 0, SP: 0, CA: 0 })
  /** Quy tắc vận hành của cửa hàng */
  const ops = useStorage('ops', {
    requireShift: true, // phải mở ca mới được bán / thu tiền
    autoLockMin: 10, // tự khoá màn hình sau N phút không thao tác (0 = tắt)
    demo: false, // đang dùng dữ liệu mẫu (hiện gợi ý PIN ở màn đăng nhập)
  })

  /** Tài khoản nhận chuyển khoản (VietQR) */
  // Mặc định: MB Bank của Yến (BIN 970422). Đổi trong Cài đặt -> Thanh toán.
  const DEFAULT_PAYMENT = LEGACY_PAYMENT
  // Tài khoản MB của Yến chỉ là mặc định của Dreamers; quán khác tự nhập tài khoản của mình
  const payment = useStorage('payment', isLegacy ? { ...DEFAULT_PAYMENT } : { bin: '', account: '', holder: '', qrOnReceipt: true })
  // Máy đang để trống tài khoản (bản cũ) -> điền tài khoản MB của Yến, chỉ 1 lần (sau đó chủ quán xoá / đổi thì giữ nguyên)
  if (isLegacy && !localStorage.getItem(nsKey('payDefault'))) {
    if (!payment.value.account) Object.assign(payment.value, { bin: DEFAULT_PAYMENT.bin, account: DEFAULT_PAYMENT.account, qrOnReceipt: true })
    localStorage.setItem(nsKey('payDefault'), '1')
  }
  /** Hoá đơn điện tử */
  const einvoice = useStorage('einvoice', {
    provider: 'none', // none | sandbox | misa | viettel | vnpt
    taxCode: '', // MST người bán
    sellerName: '', // tên đơn vị trên HĐĐT
    templateCode: '', // ký hiệu mẫu số
    series: '', // ký hiệu hoá đơn, VD 1C26TDW
    username: '', // tài khoản API do nhà cung cấp cấp (mật khẩu lưu ở máy chủ, không lưu ở đây)
    autoIssue: false, // tự xuất HĐĐT sau mỗi lần thanh toán
    vatRate: 8, // % thuế GTGT áp dụng (tuỳ chính sách từng kỳ)
  })
  /** Máy in hoá đơn: khổ giấy '80' (K80) | '58' (K58) | 'a4' */
  const printer = useStorage('printer', { paper: '80' })
  /** Đồng bộ lịch OTA (iCal) */
  const channels = useStorage('channels', { autoSyncMin: 15, lastSync: null })

  /** Sinh mã tăng dần: nextCode('HD') -> HD000001 */
  function nextCode(prefix, digits = 6) {
    counters.value[prefix] = (counters.value[prefix] || 0) + 1
    return prefix + String(counters.value[prefix]).padStart(digits, '0')
  }

  return { shop, counters, ops, payment, einvoice, channels, printer, nextCode }
})
