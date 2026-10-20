/**
 * CA LÀM VIỆC (két tiền)
 * Mở ca: nhập tiền đầu ca → bán hàng → Đóng ca: đếm tiền thực tế, so với tiền dự kiến.
 * Tiền dự kiến = tiền đầu ca + tiền mặt thu trong ca (hoá đơn hoàn thành, trả tiền mặt).
 */
import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useStorage } from '../utils/storage'
import { uid } from '../utils/format'
import { useSettings } from './settings'
import { useAuth } from './auth'
import { useAudit } from './audit'
import { useInvoices } from './invoices'

/** Mệnh giá tiền Việt dùng để đếm két */
export const DENOMINATIONS = [500000, 200000, 100000, 50000, 20000, 10000, 5000, 2000, 1000]

export const useShifts = defineStore('shifts', () => {
  /** { id, code, userId, userName, openedAt, openingCash, closedAt, closedById, closedByName, countedCash, counts, expectedCash, diff, note, status } */
  const items = useStorage('shifts', [])
  const current = computed(() => items.value.find((s) => s.status === 'open') || null)
  const byId = (id) => items.value.find((s) => s.id === id)

  /** Tổng hợp doanh thu của 1 ca */
  function summary(shift) {
    const inv = useInvoices().items.filter((i) => i.shiftId === shift.id)
    const done = inv.filter((i) => i.status === 'completed')
    const by = (m) => done.filter((i) => i.method === m).reduce((s, i) => s + i.total, 0)
    const cashSales = by('cash')
    return {
      count: done.length,
      cancelled: inv.length - done.length,
      revenue: done.reduce((s, i) => s + i.total, 0),
      discount: done.reduce((s, i) => s + i.discount, 0),
      cash: cashSales,
      transfer: by('transfer'),
      card: by('card'),
      retail: done.filter((i) => i.type === 'retail').reduce((s, i) => s + i.total, 0),
      room: done.filter((i) => i.type === 'room').reduce((s, i) => s + i.total, 0),
      expectedCash: (shift.openingCash || 0) + cashSales,
    }
  }

  function open(openingCash = 0, note = '') {
    if (current.value) throw new Error(`Đang có ca ${current.value.code} chưa đóng`)
    const auth = useAuth()
    const s = {
      id: uid(),
      code: useSettings().nextCode('CA', 4),
      userId: auth.user?.id,
      userName: auth.user?.name,
      openedAt: new Date().toISOString(),
      openingCash: +openingCash || 0,
      note,
      status: 'open',
    }
    items.value.unshift(s)
    useAudit().log('shift.open', `Mở ca ${s.code} · tiền đầu ca ${s.openingCash.toLocaleString('vi-VN')} ₫`)
    return s
  }

  function close({ countedCash, counts, note = '' }) {
    const s = current.value
    if (!s) return
    const auth = useAuth()
    const sum = summary(s)
    Object.assign(s, {
      status: 'closed',
      closedAt: new Date().toISOString(),
      closedById: auth.user?.id,
      closedByName: auth.user?.name,
      countedCash: +countedCash || 0,
      counts: counts || null,
      expectedCash: sum.expectedCash,
      diff: (+countedCash || 0) - sum.expectedCash,
      revenue: sum.revenue,
      invoiceCount: sum.count,
      closeNote: note,
    })
    useAudit().log('shift.close', `Đóng ca ${s.code} · đếm ${s.countedCash.toLocaleString('vi-VN')} ₫ · lệch ${s.diff.toLocaleString('vi-VN')} ₫`)
    return s
  }

  return { items, current, byId, summary, open, close }
})
