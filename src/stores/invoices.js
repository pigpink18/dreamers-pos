import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useStorage } from '../utils/storage'
import { uid } from '../utils/format'
import { useSettings } from './settings'
import { useProducts } from './products'
import { useAuth } from './auth'
import { useShifts } from './shifts'
import { useUi } from './ui'
import { useAudit } from './audit'

export const PAY_METHODS = { cash: 'Tiền mặt', transfer: 'Chuyển khoản', card: 'Thẻ' }
export const INVOICE_TYPES = { retail: 'Bán hàng', room: 'Tiền phòng' }

export const useInvoices = defineStore('invoices', () => {
  const settings = useSettings()
  const products = useProducts()

  /**
   * {
   *   id, code, createdAt, type: 'retail'|'room', status: 'completed'|'cancelled',
   *   customerId, customerName,
   *   items: [{ productId?, name, price, cost, qty }],
   *   subtotal, discount, total, paid, method, note, bookingId?
   * }
   */
  const items = useStorage('invoices', [])

  const completed = computed(() => items.value.filter((i) => i.status === 'completed'))
  const byId = (id) => items.value.find((i) => i.id === id)

  function create(data) {
    const subtotal = data.items.reduce((s, l) => s + l.price * l.qty, 0)
    const discount = Math.min(+data.discount || 0, subtotal)
    const inv = {
      id: uid(),
      code: settings.nextCode('HD'),
      createdAt: data.createdAt || new Date().toISOString(),
      type: data.type || 'retail',
      status: 'completed',
      customerId: data.customerId || null,
      customerName: data.customerName || 'Khách lẻ',
      items: data.items.map((l) => ({ ...l })),
      subtotal,
      discount,
      total: subtotal - discount,
      paid: data.paid ?? subtotal - discount,
      method: data.method || 'cash',
      note: data.note || '',
      bookingId: data.bookingId || null,
      deposit: data.deposit || 0,
      // ai bán, thuộc ca nào (để đối soát cuối ca)
      createdById: data.createdById ?? useAuth().user?.id ?? null,
      createdByName: data.createdByName ?? useAuth().user?.name ?? '',
      shiftId: data.shiftId !== undefined ? data.shiftId : useShifts().current?.id || null,
      discountApprovedBy: data.discountApprovedBy || null,
    }
    if (!data.skipStock) inv.items.forEach((l) => l.productId && products.adjustStock(l.productId, -l.qty))
    items.value.unshift(inv)
    // Tự xuất hoá đơn điện tử nếu đã bật (chạy nền, lỗi thì hoá đơn hiện "Xuất HĐĐT lỗi" để xuất lại)
    const ecfg = settings.einvoice
    if (ecfg?.autoIssue && ecfg.provider && ecfg.provider !== 'none' && !data.skipEinvoice)
      import('../einvoice').then((m) => m.issueEinvoice(inv.id)).catch((e) => useUi().toast(`HĐĐT ${inv.code}: ${e.message}`, 'error'))
    useAudit().log('invoice.create', `${inv.code} · ${inv.total.toLocaleString('vi-VN')} ₫`, data.discountApprovedBy ? { approvedBy: data._approver } : {})
    return inv
  }

  /** Huỷ hoá đơn: trả lại tồn kho */
  function cancel(id, reason = '', approver = null) {
    const inv = byId(id)
    if (!inv || inv.status === 'cancelled') return
    const auth = useAuth()
    inv.status = 'cancelled'
    inv.cancelReason = reason
    inv.cancelledAt = new Date().toISOString()
    inv.cancelledByName = auth.user?.name || ''
    inv.cancelApprovedBy = approver && approver.id !== auth.user?.id ? approver.name : null
    useAudit().log('invoice.cancel', `${inv.code} · ${inv.total.toLocaleString('vi-VN')} ₫` + (reason ? ` · Lý do: ${reason}` : ''), { approvedBy: approver })
    inv.items.forEach((l) => l.productId && products.adjustStock(l.productId, l.qty))
  }

  const ofCustomer = (customerId) => items.value.filter((i) => i.customerId === customerId)

  return { items, completed, byId, create, cancel, ofCustomer }
})
