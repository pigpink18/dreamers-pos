/**
 * Trạng thái mở quán lúc khởi động (hệ thống nhiều quán)
 *  ready       — dữ liệu quán đã có trên máy, dùng bình thường
 *  needSession — cần đăng nhập tài khoản chủ quán (máy mới / phiên hết hạn) mới tải được dữ liệu quán
 *  error       — không tải được dữ liệu quán (thường do mất mạng ở lần mở đầu tiên)
 */
import { reactive } from 'vue'
export const boot = reactive({ state: 'ready', error: '' })
