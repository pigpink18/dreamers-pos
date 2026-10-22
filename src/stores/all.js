/**
 * Khởi tạo TẤT CẢ kho dữ liệu cùng lúc.
 * Bắt buộc trước khi đồng bộ: bộ đồng bộ chỉ gửi/nhận những bộ dữ liệu đã được khởi tạo
 * (nếu không, VD menu chưa mở trang Hàng hoá thì sẽ không được gửi lên / tải về).
 */
import { useAuth } from './auth'
import { useSettings } from './settings'
import { useProducts } from './products'
import { useCustomers } from './customers'
import { useInvoices } from './invoices'
import { useRooms } from './rooms'
import { useShifts } from './shifts'
import { useAudit } from './audit'

export function useAllStores() {
  return [useAuth(), useSettings(), useProducts(), useCustomers(), useInvoices(), useRooms(), useShifts(), useAudit()]
}
