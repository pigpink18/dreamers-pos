import { defineStore } from 'pinia'
import { useStorage } from '../utils/storage'

export const useSettings = defineStore('settings', () => {
  const shop = useStorage('shop', {
    name: 'Dreamers Home & Coffee',
    address: '19B Đặng Thái Thân, Phường 3, TP. Đà Lạt, Lâm Đồng',
    phone: '(+84) 865 665 603',
    footer: 'Cảm ơn quý khách — hẹn gặp lại tại Dreamers!',
  })
  const counters = useStorage('counters', { HD: 0, DP: 0, PN: 0, KH: 0, SP: 0, CA: 0 })
  /** Quy tắc vận hành của cửa hàng */
  const ops = useStorage('ops', {
    requireShift: true, // phải mở ca mới được bán / thu tiền
    autoLockMin: 10, // tự khoá màn hình sau N phút không thao tác (0 = tắt)
    demo: false, // đang dùng dữ liệu mẫu (hiện gợi ý PIN ở màn đăng nhập)
  })

  /** Tài khoản nhận chuyển khoản (VietQR) */
  const payment = useStorage('payment', { bin: '', account: '', holder: '', qrOnReceipt: true })
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
  /** Đồng bộ lịch OTA (iCal) */
  const channels = useStorage('channels', { autoSyncMin: 15, lastSync: null })

  /** Sinh mã tăng dần: nextCode('HD') -> HD000001 */
  function nextCode(prefix, digits = 6) {
    counters.value[prefix] = (counters.value[prefix] || 0) + 1
    return prefix + String(counters.value[prefix]).padStart(digits, '0')
  }

  return { shop, counters, ops, payment, einvoice, channels, nextCode }
})
