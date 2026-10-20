/**
 * KÊNH ĐẶT PHÒNG — đồng bộ lịch Booking.com / Airbnb qua iCal (miễn phí, không cần channel manager)
 *
 * Nhập (OTA → Dreamers): mỗi phòng dán link "Xuất lịch" của Booking.com / Airbnb. App tải lịch,
 *   tạo lượt đặt "Khách Booking.com / Airbnb" để sơ đồ phòng & lịch không nhận trùng.
 * Xuất (Dreamers → OTA): mỗi phòng có 1 link lịch (Edge Function `ical`) để dán vào OTA,
 *   khách đặt trực tiếp tại quán sẽ tự khoá ngày đó trên Booking.com / Airbnb.
 *
 * Lưu ý: iCal chỉ chứa ngày bận, KHÔNG có tên khách / giá. OTA thường cập nhật lịch mỗi 1–3 giờ.
 */
import { useRooms } from '../stores/rooms'
import { useSettings } from '../stores/settings'
import { useAudit } from '../stores/audit'
import { dateKey } from '../utils/format'

export const CHANNELS = {
  booking: { label: 'Booking.com', guest: 'Khách Booking.com' },
  airbnb: { label: 'Airbnb', guest: 'Khách Airbnb' },
}

// ---------- Đọc file .ics ----------
const unfold = (t) => t.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '')
const icsDate = (v = '') => {
  const m = v.match(/(\d{4})(\d{2})(\d{2})/)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null
}
const unescape = (s = '') => s.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1')

/** → [{ uid, start, end, summary, description }] (end = ngày trả phòng, không tính đêm) */
export function parseIcs(text) {
  const out = []
  let ev = null
  for (const line of unfold(text).split('\n')) {
    if (line === 'BEGIN:VEVENT') ev = {}
    else if (line === 'END:VEVENT') {
      if (ev?.start) out.push({ end: ev.end || ev.start, ...ev })
      ev = null
    } else if (ev) {
      const i = line.indexOf(':')
      if (i < 0) continue
      const name = line.slice(0, i).split(';')[0].toUpperCase()
      const val = line.slice(i + 1)
      if (name === 'UID') ev.uid = val.trim()
      else if (name === 'DTSTART') ev.start = icsDate(val)
      else if (name === 'DTEND') ev.end = icsDate(val)
      else if (name === 'SUMMARY') ev.summary = unescape(val)
      else if (name === 'DESCRIPTION') ev.description = unescape(val)
    }
  }
  return out.filter((e) => e.uid && e.start && e.end > e.start)
}

/** Mã đặt phòng Airbnb (HM…) trong phần mô tả, nếu có */
const airbnbCode = (desc = '') => desc.match(/details\/([A-Z0-9]{8,12})/)?.[1] || ''

// id cố định theo UID -> 2 máy cùng nhập 1 sự kiện vẫn chỉ ra 1 lượt đặt
function stableId(s) {
  let h1 = 0x811c9dc5, h2 = 0x01000193
  for (let i = 0; i < s.length; i++) { h1 = Math.imul(h1 ^ s.charCodeAt(i), 16777619); h2 = Math.imul(h2 ^ s.charCodeAt(i), 2654435761) }
  return 'ota-' + (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36)
}

// ---------- Tải lịch ----------
async function fetchIcs(url) {
  // Ưu tiên qua máy chủ (OTA không cho trình duyệt tải trực tiếp)
  try {
    const { getClient } = await import('../sync/connection')
    const c = getClient()
    if (c) {
      const { data, error } = await c.functions.invoke('ical', { body: { action: 'fetch', url } })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      return data.ics
    }
  } catch (e) {
    if (e?.message && !/Failed to send|fetch/i.test(e.message)) throw e
  }
  const r = await fetch(url) // trường hợp OTA cho phép tải trực tiếp
  if (!r.ok) throw new Error('Không tải được lịch (' + r.status + ')')
  return r.text()
}

/**
 * Áp lịch của 1 kênh cho 1 phòng. Trả về { added, updated, cancelled, skipped }
 * (tách riêng để kiểm thử không cần mạng)
 */
export function applyEvents(roomId, channel, events, today = dateKey()) {
  const rooms = useRooms()
  const room = rooms.roomById(roomId)
  const res = { added: 0, updated: 0, cancelled: 0, skipped: 0 }
  const seen = new Set()
  for (const ev of events) {
    if (ev.end <= today) continue // đã qua
    const id = stableId(channel + '|' + roomId + '|' + ev.uid)
    seen.add(id)
    const existing = rooms.bookingById(id)
    if (existing) {
      if (existing.status === 'booked' && (existing.checkIn !== ev.start || existing.checkOut !== ev.end)) {
        existing.checkIn = ev.start; existing.checkOut = ev.end; res.updated++
      } else if (existing.status === 'cancelled') {
        existing.status = 'booked'; existing.checkIn = ev.start; existing.checkOut = ev.end; res.updated++
      }
      continue
    }
    // Trùng y hệt 1 lượt đặt tại quán -> đây là lịch Dreamers đã xuất sang OTA rồi OTA trả lại -> bỏ qua
    const echo = rooms.bookings.find((b) => b.roomId === roomId && !b.channel && b.status !== 'cancelled' && b.checkIn === ev.start && b.checkOut === ev.end)
    if (echo) { res.skipped++; continue }
    const conflict = rooms.bookings.find((b) => b.roomId === roomId && b.status !== 'cancelled' && b.checkIn < ev.end && ev.start < b.checkOut)
    const code = channel === 'airbnb' ? airbnbCode(ev.description) : ''
    rooms.bookings.push({
      id, roomId, status: 'booked', deposit: 0, guests: 1,
      code: (channel === 'airbnb' ? 'AB-' : 'BK-') + (code || id.slice(4, 10).toUpperCase()),
      guestName: CHANNELS[channel].guest + (code ? ` · ${code}` : ''),
      phone: '', checkIn: ev.start, checkOut: ev.end,
      note: [ev.summary, conflict ? `⚠ Trùng lịch với ${conflict.code} (${conflict.guestName}) — kiểm tra lại` : ''].filter(Boolean).join(' · '),
      channel, extUid: ev.uid, createdAt: new Date().toISOString(),
    })
    res.added++
    if (conflict) useAudit().log('booking.create', `⚠ ${CHANNELS[channel].label} đặt phòng ${room?.name} ${ev.start} → ${ev.end} trùng với ${conflict.code}`)
  }
  // Sự kiện biến mất khỏi lịch OTA = khách huỷ (chỉ huỷ lượt chưa nhận phòng, chưa tới ngày)
  rooms.bookings
    .filter((b) => b.roomId === roomId && b.channel === channel && b.status === 'booked' && !seen.has(b.id) && b.checkOut > today)
    .forEach((b) => { b.status = 'cancelled'; b.note = (b.note ? b.note + ' · ' : '') + `${CHANNELS[channel].label} đã huỷ`; res.cancelled++ })
  return res
}

/** Đồng bộ mọi phòng có link iCal */
export async function syncChannels() {
  const rooms = useRooms()
  const settings = useSettings()
  const total = { added: 0, updated: 0, cancelled: 0, skipped: 0, errors: [] }
  for (const room of rooms.rooms) {
    for (const ch of Object.keys(CHANNELS)) {
      const url = room.ical?.[ch]
      if (!url) continue
      try {
        const events = parseIcs(await fetchIcs(url))
        const r = applyEvents(room.id, ch, events)
        Object.keys(r).forEach((k) => (total[k] += r[k]))
      } catch (e) {
        total.errors.push(`${room.name} · ${CHANNELS[ch].label}: ${e.message}`)
      }
    }
  }
  settings.channels.lastSync = new Date().toISOString()
  settings.channels.lastResult = { added: total.added, updated: total.updated, cancelled: total.cancelled, errors: total.errors }
  if (total.added || total.updated || total.cancelled)
    useAudit().log('channel.sync', `+${total.added} đặt mới · ${total.updated} đổi ngày · ${total.cancelled} huỷ`)
  return total
}

const hasLinks = () => useRooms().rooms.some((r) => r.ical && Object.values(r.ical).some(Boolean))
let timer = null
/** Tự đồng bộ định kỳ khi app đang mở */
export function startAutoSync() {
  clearInterval(timer)
  const min = +useSettings().channels.autoSyncMin || 0
  if (!min) return
  const run = () => hasLinks() && navigator.onLine && syncChannels().catch(() => {})
  setTimeout(run, 5000)
  timer = setInterval(run, min * 60000)
}
