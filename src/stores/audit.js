/**
 * NHẬT KÝ THAO TÁC — ai làm gì, lúc nào, ai duyệt.
 * Dùng: useAudit().log('invoice.cancel', 'Huỷ HD000123', { approvedBy: user })
 */
import { defineStore } from 'pinia'
import { useStorage } from '../utils/storage'
import { uid } from '../utils/format'
import { useAuth } from './auth'

export const ACTIONS = {
  login: ['Đăng nhập', 'login'], 'login.switch': ['Đổi người dùng', 'login'], 'login.fail': ['Sai PIN', 'alert'],
  lock: ['Khoá màn hình', 'key'], logout: ['Đăng xuất', 'logout'],
  'shift.open': ['Mở ca', 'wallet'], 'shift.close': ['Đóng ca', 'wallet'],
  'einvoice.issue': ['Xuất HĐĐT', 'fa-file-invoice'], 'channel.sync': ['Đồng bộ kênh đặt phòng', 'fa-calendar-arrow-down'],
  'invoice.create': ['Tạo hoá đơn', 'receipt'], 'invoice.cancel': ['Huỷ hoá đơn', 'trash'], 'invoice.discount': ['Giảm giá vượt mức', 'alert'],
  'booking.create': ['Đặt phòng', 'calendar'], 'booking.update': ['Sửa đặt phòng', 'calendar'], 'booking.cancel': ['Huỷ đặt phòng', 'trash'],
  'room.checkin': ['Nhận phòng', 'login'], 'room.checkout': ['Trả phòng', 'logout'], 'room.clean': ['Dọn phòng xong', 'broom'], 'room.update': ['Sửa phòng', 'bed'],
  'product.create': ['Thêm hàng hoá', 'box'], 'product.update': ['Sửa hàng hoá', 'edit'], 'product.price': ['Đổi giá bán', 'money'], 'product.disable': ['Ngừng bán', 'trash'],
  'stock.import': ['Nhập kho', 'upload'],
  'customer.create': ['Thêm khách', 'users'], 'customer.delete': ['Xoá khách', 'trash'],
  'user.create': ['Thêm người dùng', 'user-plus'], 'user.update': ['Sửa người dùng', 'users'], 'user.disable': ['Khoá tài khoản', 'key'], 'user.enable': ['Mở tài khoản', 'key'],
  'role.update': ['Phân quyền', 'settings'], 'role.delete': ['Xoá vai trò', 'trash'],
  'settings.update': ['Đổi cài đặt', 'settings'], 'data.reset': ['Xoá / nạp lại dữ liệu', 'alert'], 'data.restore': ['Khôi phục dữ liệu', 'upload'],
}
const MAX = 3000
let paused = false
/** Chạy hàm mà không ghi nhật ký (dùng khi nạp dữ liệu mẫu) */
export function withoutAudit(fn) { paused = true; try { return fn() } finally { paused = false } }

export const useAudit = defineStore('audit', () => {
  /** { id, at, userId, userName, action, detail, approvedBy } */
  const entries = useStorage('audit', [])

  function log(action, detail = '', { user, approvedBy, at } = {}) {
    if (paused) return
    let u = user
    if (u === undefined) {
      try { u = useAuth().user } catch { u = null }
    }
    entries.value.unshift({
      id: uid(),
      at: at || new Date().toISOString(),
      userId: u?.id || null,
      userName: u?.name || 'Hệ thống',
      action,
      detail,
      approvedBy: approvedBy && approvedBy.id !== u?.id ? approvedBy.name : null,
    })
    if (entries.value.length > MAX) entries.value.length = MAX
  }

  return { entries, log }
})
