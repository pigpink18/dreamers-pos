import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useStorage } from '../utils/storage'
import { uid, dateKey, diffDays, addDays } from '../utils/format'
import { useSettings } from './settings'
import { useInvoices } from './invoices'
import { useAudit } from './audit'

/** Trạng thái phòng hiển thị trên sơ đồ */
export const ROOM_STATUS = {
  vacant: { label: 'Đang trống', badge: 'success' },
  reserved: { label: 'Sắp nhận', badge: 'info' },
  occupied: { label: 'Đang ở', badge: 'danger' },
  checkedout: { label: 'Đã trả – chờ dọn', badge: 'warning' },
}
/** Trạng thái của 1 lượt đặt phòng */
export const BOOKING_STATUS = {
  booked: { label: 'Đã đặt', badge: 'info' },
  staying: { label: 'Đang ở', badge: 'danger' },
  checked_out: { label: 'Đã trả phòng', badge: 'success' },
  cancelled: { label: 'Đã huỷ', badge: '' },
}

export const useRooms = defineStore('rooms', () => {
  const settings = useSettings()
  const invoices = useInvoices()

  /** { id, name, type, floor, price, capacity, housekeeping: 'clean'|'dirty', note } */
  const rooms = useStorage('rooms', [])
  /**
   * Đêm ở: từ checkIn (bao gồm) tới checkOut (không bao gồm) — dạng 'YYYY-MM-DD'
   * { id, code, roomId, customerId, guestName, phone, guests, checkIn, checkOut,
   *   status, deposit, note, createdAt, checkedInAt, checkedOutAt, invoiceId }
   */
  const bookings = useStorage('bookings', [])

  const roomById = (id) => rooms.value.find((r) => r.id === id)
  const bookingById = (id) => bookings.value.find((b) => b.id === id)
  const liveBookings = computed(() => bookings.value.filter((b) => b.status !== 'cancelled'))

  /** Lượt đặt chiếm phòng vào đêm `day` */
  const bookingOn = (roomId, day) =>
    liveBookings.value.find((b) => b.roomId === roomId && b.checkIn <= day && day < b.checkOut)

  const stayingIn = (roomId) => bookings.value.find((b) => b.roomId === roomId && b.status === 'staying')

  /** Lượt đặt sắp tới (chưa nhận) gần nhất của phòng */
  const nextBooking = (roomId) =>
    bookings.value
      .filter((b) => b.roomId === roomId && b.status === 'booked')
      .sort((a, b) => a.checkIn.localeCompare(b.checkIn))[0]

  /** Trạng thái hiện tại của phòng */
  function statusOf(room) {
    const today = dateKey()
    if (stayingIn(room.id)) return 'occupied'
    if (room.housekeeping === 'dirty') return 'checkedout'
    const nb = nextBooking(room.id)
    if (nb && nb.checkIn <= today) return 'reserved'
    return 'vacant'
  }

  const summary = computed(() => {
    const s = { vacant: 0, reserved: 0, occupied: 0, checkedout: 0 }
    rooms.value.forEach((r) => s[statusOf(r)]++)
    return s
  })

  /** Kiểm tra trùng lịch, trả về lượt đặt bị trùng (nếu có) */
  function findConflict({ roomId, checkIn, checkOut, id }) {
    return liveBookings.value.find(
      (b) => b.id !== id && b.roomId === roomId && b.checkIn < checkOut && checkIn < b.checkOut
    )
  }

  const priceText = (b) => (isPackage(b) ? `trọn gói ${(+b.packagePrice || 0).toLocaleString('vi-VN')} ₫` : `${rateOf(b).toLocaleString('vi-VN')} ₫/đêm`)

  function saveBooking(data) {
    if (data.checkOut <= data.checkIn) throw new Error('Ngày trả phòng phải sau ngày nhận phòng')
    const c = findConflict(data)
    if (c) throw new Error(`Trùng lịch với ${c.code} (${c.guestName})`)
    if (data.id) {
      const b = bookingById(data.id)
      Object.assign(b, data)
      useAudit().log('booking.update', `${b.code} · ${b.guestName} · ${roomById(b.roomId)?.name} · ${b.checkIn} → ${b.checkOut} · ${priceText(b)}`)
      return b
    }
    const b = {
      status: 'booked',
      deposit: 0,
      guests: 1,
      ...data,
      id: uid(),
      code: settings.nextCode('DP'),
      createdAt: new Date().toISOString(),
    }
    bookings.value.push(b)
    useAudit().log('booking.create', `${b.code} · ${b.guestName} · ${roomById(b.roomId)?.name} · ${b.checkIn} → ${b.checkOut} · ${priceText(b)}`)
    return b
  }

  function checkIn(id) {
    const b = bookingById(id)
    // Phòng đang có khách khác ở -> phải trả phòng cho khách đó trước
    const other = bookings.value.find((x) => x.id !== b.id && x.roomId === b.roomId && x.status === 'staying')
    if (other) throw new Error(`Phòng ${roomById(b.roomId)?.name} đang có khách ${other.guestName} — trả phòng cho khách đó trước`)
    b.status = 'staying'
    b.checkedInAt = new Date().toISOString()
    // Nhận sớm hơn ngày đặt -> dời ngày nhận về hôm nay
    const today = dateKey()
    if (today < b.checkIn) b.checkIn = today
    useAudit().log('room.checkin', `${b.guestName} nhận phòng ${roomById(b.roomId)?.name} (${b.code})`)
  }

  /** Số đêm tính tiền nếu trả phòng vào ngày `outDay` */
  const nightsFor = (b, outDay = dateKey()) => Math.max(1, diffDays(b.checkIn, outDay))

  /**
   * Giá phòng của từng lượt đặt (không cố định theo phòng):
   * b.priceMode = 'night' (giá / đêm, b.rate) | 'package' (trọn gói cả kỳ ở, b.packagePrice)
   * Lượt đặt cũ chưa có giá riêng -> dùng giá niêm yết của phòng.
   */
  const rateOf = (b) => (b?.rate != null && b.rate !== '' ? +b.rate : +(roomById(b?.roomId)?.price || 0))
  const isPackage = (b) => b?.priceMode === 'package'
  function roomChargeFor(b, nights = diffDays(b.checkIn, b.checkOut)) {
    return isPackage(b) ? +b.packagePrice || 0 : Math.max(0, nights) * rateOf(b)
  }
  /** Giá có khác giá niêm yết không (để hiện nhãn "Giá riêng") */
  const customPrice = (b) => isPackage(b) || (b?.rate != null && +b.rate !== +(roomById(b.roomId)?.price || 0))

  /**
   * Trả phòng: chốt số đêm, tạo hoá đơn tiền phòng, đánh dấu phòng "chờ dọn"
   * extras: [{ productId?, name, price, qty }]
   */
  function checkOut(id, { extras = [], discount = 0, method = 'cash', note = '', price = null } = {}) {
    const b = bookingById(id)
    const room = roomById(b.roomId)
    const today = dateKey()
    const nights = nightsFor(b, today)
    // Trả phòng muộn hơn lịch: không được kéo dài đè lên lịch của khách sau
    const newOut = today > b.checkIn ? today : addDays(b.checkIn, 1)
    if (newOut > b.checkOut) {
      const c = findConflict({ roomId: b.roomId, checkIn: b.checkOut, checkOut: newOut, id: b.id })
      if (c) throw new Error(`Trả phòng muộn sẽ trùng lịch ${c.code} (${c.guestName}) — sửa lại lịch rồi trả phòng`)
    }
    // Giá chốt lúc trả phòng (có thể đã sửa ngay trong màn trả phòng)
    const pr = price || { priceMode: b.priceMode || 'night', rate: rateOf(b), packagePrice: b.packagePrice }
    const roomLine = pr.priceMode === 'package'
      ? { name: `Phòng ${room.name} (${room.type}) · trọn gói ${nights} đêm`, price: Math.max(0, Math.round(+pr.packagePrice || 0)), cost: 0, qty: 1 }
      : { name: `Phòng ${room.name} (${room.type}) × ${nights} đêm`, price: Math.max(0, Math.round(+pr.rate || 0)), cost: 0, qty: nights }
    const items = [roomLine, ...extras]
    const inv = invoices.create({
      type: 'room',
      customerId: b.customerId,
      customerName: b.guestName,
      items,
      discount,
      method,
      note,
      bookingId: b.id,
      deposit: b.deposit,
    })
    b.priceMode = pr.priceMode
    if (pr.priceMode === 'package') b.packagePrice = roomLine.price
    else b.rate = roomLine.price
    b.status = 'checked_out'
    b.checkedOutAt = new Date().toISOString()
    b.checkOut = newOut
    b.invoiceId = inv.id
    room.housekeeping = 'dirty'
    useAudit().log('room.checkout', `${b.guestName} trả phòng ${room.name} · ${inv.code}`)
    return inv
  }

  function cancelBooking(id, approver = null) {
    const b = bookingById(id)
    b.status = 'cancelled'
    useAudit().log('booking.cancel', `${b.code} · ${b.guestName} · ${roomById(b.roomId)?.name}`, { approvedBy: approver })
  }

  function markClean(roomId) {
    const r = roomById(roomId)
    r.housekeeping = 'clean'
    r.cleanedAt = new Date().toISOString()
    useAudit().log('room.clean', `Phòng ${r.name} đã dọn xong`)
  }

  function saveRoom(data) {
    if (data.id) {
      const r = roomById(data.id)
      const oldPrice = r.price
      Object.assign(r, data)
      useAudit().log('room.update', `Sửa phòng ${r.name}` + (oldPrice !== r.price ? ` · giá ${oldPrice.toLocaleString('vi-VN')} → ${r.price.toLocaleString('vi-VN')} ₫` : ''))
      return r
    }
    rooms.value.push({ housekeeping: 'clean', capacity: 2, ...data, id: uid() })
    useAudit().log('room.update', `Thêm phòng ${data.name}`)
  }

  function removeRoom(id) {
    if (bookings.value.some((b) => b.roomId === id && ['booked', 'staying'].includes(b.status)))
      throw new Error('Phòng đang có khách hoặc lịch đặt, không thể xoá')
    const r = roomById(id)
    rooms.value = rooms.value.filter((x) => x.id !== id)
    useAudit().log('room.update', `Xoá phòng ${r?.name || ''}`)
  }

  return {
    rooms, bookings, liveBookings, roomById, bookingById, bookingOn, stayingIn, nextBooking,
    statusOf, summary, findConflict, saveBooking, checkIn, checkOut, nightsFor, rateOf, isPackage, roomChargeFor, customPrice, priceText, cancelBooking,
    markClean, saveRoom, removeRoom,
  }
})
