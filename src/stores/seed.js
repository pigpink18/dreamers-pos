/**
 * Dữ liệu mẫu để app có số liệu báo cáo ngay khi mở lần đầu.
 * Xoá được trong trang Cài đặt.
 */
import { useSettings } from './settings'
import { useProducts } from './products'
import { useCustomers } from './customers'
import { useInvoices } from './invoices'
import { useRooms } from './rooms'
import { dateKey, addDays, parseKey } from '../utils/format'
import { markSeeded } from '../utils/storage'
import { useAuth, hashPin } from './auth'
import { useShifts } from './shifts'
import { useAudit, withoutAudit } from './audit'

// Nhân viên mẫu: [tên, vai trò, PIN]
export const DEMO_USERS = [
  ['Yến', 'owner', '240819'],
  ['Lam', 'staff', '123456'],
]

// Random có seed -> lần nào tạo cũng ra cùng 1 bộ dữ liệu
function rng(seed) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---- MENU THẬT CỦA DREAMERS (theo menu in) ----
// [tên, nhóm, đơn vị, giá bán, giá vốn (ước tính ~30%, chỉnh lại trong Hàng hoá), màu, quản lý tồn kho, mô tả]
const C = { arabica: '#7b4a26', ethiopia: '#a35a25', robusta: '#3b2a20', signature: '#6b5b95', matcha: '#5b6b4e', tea: '#9b4a4a', healthy: '#2f6d6a', cold: '#2a5d9f', bread: '#c08552', food: '#9b4a4a' }
const k = (n) => n * 1000
const cost = (n) => Math.round(n * 0.3) * 1000
const drink = (name, cat, price, color, desc = '') => [name, cat, 'Ly', k(price), cost(price), color, false, desc]
export const MENU = [
  // 100% Arabica
  drink('Espresso', 'Arabica', 40, C.arabica),
  drink('Cappuccino', 'Arabica', 55, C.arabica),
  drink('Latte', 'Arabica', 55, C.arabica),
  drink('Caramel coffee latte', 'Arabica', 60, C.arabica),
  drink('Americano', 'Arabica', 50, C.arabica),
  drink('Chocolate', 'Arabica', 55, C.arabica),
  drink('Mocha Latte', 'Arabica', 60, C.arabica),
  drink('Latte peanut butter', 'Arabica', 60, C.arabica),
  // 100% Ethiopia bean
  drink('Espresso Ethiopia', 'Ethiopia', 70, C.ethiopia, '100% Ethiopia bean'),
  drink('Latte Ethiopia', 'Ethiopia', 70, C.ethiopia, '100% Ethiopia bean'),
  drink('Cold Brew Ethiopia', 'Ethiopia', 70, C.ethiopia, '100% Ethiopia bean'),
  // 100% Robusta
  drink('Black coffee – đen', 'Robusta', 35, C.robusta),
  drink('Milk coffee – nâu', 'Robusta', 40, C.robusta),
  drink('White coffee – bạc xỉu', 'Robusta', 50, C.robusta),
  // Signature
  drink('Warm Spice Latte', 'Signature', 65, C.signature, 'Ginger with cinnamon and arabica coffee'),
  drink('Passion Red Cold Brew', 'Signature', 65, C.signature, 'Cold brew with hibiscus'),
  drink('Peanut Butter Latte', 'Signature', 60, C.signature, 'Served with Peanut Beans'),
  drink('Cool Yet Warm Cold Brew', 'Signature', 65, C.signature, 'With Ginger & Lime'),
  drink('Dreamo, silky smooth', 'Signature', 55, C.signature, 'Whipped with Arabica coffee'),
  drink('Cold Brew', 'Signature', 55, C.signature, 'Giá 55–70k tuỳ mùa thu hoạch cà phê'),
  // Matcha
  drink('Matcha latte', 'Matcha', 60, C.matcha, 'Giá 60–70k'),
  drink('Hime Matcha', 'Matcha', 70, C.matcha, 'Matcha with coconut'),
  drink('Matcha Coconut bong ben', 'Matcha', 65, C.matcha, 'Matcha sauce with coconut water'),
  drink('Matcha Ice-cream coconut', 'Matcha', 65, C.matcha, 'Matcha sauce with coconut water'),
  drink('Matcha Phê', 'Matcha', 70, C.matcha, 'Espresso matcha with coconut milk'),
  // Tea — only hot
  drink('Dear winter', 'Trà', 50, C.tea, 'Chỉ phục vụ nóng'),
  drink('White garden', 'Trà', 50, C.tea, 'Chỉ phục vụ nóng'),
  // Healthy
  drink('Kombucha', 'Healthy', 50, C.healthy, 'Trà Kombucha lên men tự nhiên mix với trái cây theo mùa'),
  drink('Orange juice', 'Healthy', 45, C.healthy),
  drink('Tropical smoothie', 'Healthy', 65, C.healthy),
  drink('Espresso coconut juice', 'Healthy', 55, C.healthy),
  drink('Espresso Orange juice', 'Healthy', 70, C.healthy),
  // Cold, it's unbearable!!!
  drink('Choco – non coffee', 'Cold', 50, C.cold),
  drink('Thèm chua', 'Cold', 50, C.cold),
  drink('Yo-fe coffee', 'Cold', 50, C.cold),
  drink('Sesame coffee', 'Cold', 60, C.cold),
  drink('Coconut coffee', 'Cold', 60, C.cold),
  drink('Mocha', 'Cold', 60, C.cold),
  drink('Caramel coffee latte đá', 'Cold', 60, C.cold),
  // Breads — bánh nóng hổi
  ['Croissant plain', 'Bánh', 'Cái', k(35), cost(35), C.bread, true],
  ['Croissant chocolate', 'Bánh', 'Cái', k(40), cost(40), C.bread, true],
  ['Croissant coconut', 'Bánh', 'Cái', k(40), cost(40), C.bread, true],
  ['Raisin', 'Bánh', 'Cái', k(40), cost(40), C.bread, true],
  ['Waffle with Chocolate/ Honey', 'Bánh', 'Phần', k(65), cost(65), C.bread, true],
  ['Waffle with Ice-cream coconut', 'Bánh', 'Phần', k(70), cost(70), C.bread, true],
  // Món ăn
  ['Bánh mì chảo', 'Món ăn', 'Phần', k(80), cost(80), C.food, false],
  ['Mì trộn sốt cay Samyang', 'Món ăn', 'Phần', k(80), cost(80), C.food, false],
]
const PRODUCTS = [
  ...MENU,
  ['Thuê xe máy', 'Dịch vụ', 'Ngày', 120000, 0, '#64748b', false],
  ['Giặt ủi', 'Dịch vụ', 'Kg', 30000, 5000, '#64748b', false],
  ['Phụ thu người lớn', 'Dịch vụ', 'Người/đêm', 200000, 0, '#64748b', false],
]
export const MENU_VERSION = 3 // tăng số này mỗi khi thêm món vào MENU -> máy đang dùng sẽ tự bổ sung

/** Dữ liệu thật (không phải mẫu): thêm các món trong MENU còn thiếu, chạy 1 lần cho mỗi phiên bản menu */
export function ensureMenu() {
  const key = 'dreamers:menuVersion'
  if (+localStorage.getItem(key) >= MENU_VERSION) return
  const products = useProducts()
  const have = new Set(products.items.map((p) => p.name.toLowerCase()))
  withoutAudit(() => MENU.forEach(([name, category, unit, price, cost, color, track = true, desc = '']) => {
    if (!have.has(name.toLowerCase())) products.save({ name, category, unit, price, cost, color, desc, stock: track ? 20 : 0, trackStock: track, minStock: 5 })
  }))
  // Sửa giá: chỉ đổi khi món vẫn đang ở giá cũ (không ghi đè giá chủ quán đã tự sửa)
  PRICE_FIXES.forEach(([name, from, to]) => {
    const p = products.items.find((x) => x.name === name)
    if (p && p.price === from) { p.price = to; p.cost = Math.round(to * 0.3 / 1000) * 1000 }
  })
  localStorage.setItem(key, String(MENU_VERSION))
}
// [tên món, giá cũ, giá mới]
const PRICE_FIXES = [['Mì trộn sốt cay Samyang', 60000, 80000]]

const NAMES = ['Nguyễn Minh Anh', 'Trần Quốc Bảo', 'Lê Thu Hà', 'Phạm Gia Huy', 'Võ Ngọc Lan', 'Đặng Hoàng Nam',
  'Bùi Khánh Linh', 'Hồ Đức Thịnh', 'Ngô Phương Thảo', 'Dương Tuấn Kiệt', 'Mai Thanh Trúc', 'Lý Hải Đăng']
// 7 phòng theo bảng giá Dreamers: [tên, tên tiếng Anh, tầng, giá/đêm, sức chứa]
export const ROOMS = [
  ['Mây', 'Cloud Room', 1, 820000, 2],
  ['Nắng', 'Sunny Room', 1, 820000, 2],
  ['Gió', 'Wind Room', 1, 820000, 2],
  ['Thu', 'Autumn Room', 1, 780000, 2],
  ['Hạ', 'Summer Room', 1, 780000, 2],
  ['Đông', 'Winter Room', 1, 500000, 2],
  ['Sương', 'Mist Room', 1, 680000, 2],
]

/** App mới hoàn toàn: chỉ có 2 tài khoản Yến (chủ quán) và Lam (nhân viên), chưa có món, phòng hay hoá đơn */
export function seedFresh() {
  withoutAudit(() => {
    const auth = useAuth()
    DEMO_USERS.forEach(([name, roleId, pin], i) =>
      auth.users.push({ id: 'u' + (i + 1), name, roleId, pinHash: hashPin(pin), active: true, createdAt: new Date().toISOString() })
    )
  })
  useSettings().ops.demo = false
  markSeeded()
  localStorage.setItem('dreamers:menuVersion', String(MENU_VERSION)) // không tự thêm menu mẫu
}

/** Nạp toàn bộ dữ liệu mẫu (không ghi nhật ký trong lúc nạp) */
export function seedDemo() {
  withoutAudit(seedAll)
  seedAuditSamples()
  useSettings().ops.demo = true
  markSeeded()
  localStorage.setItem('dreamers:menuVersion', String(MENU_VERSION))
}

function seedAll() {
  const R = rng(2026)
  const pick = (arr) => arr[Math.floor(R() * arr.length)]
  const int = (a, b) => a + Math.floor(R() * (b - a + 1))

  const products = useProducts()
  const customers = useCustomers()
  const invoices = useInvoices()
  const rooms = useRooms()
  const auth = useAuth()
  const shifts = useShifts()
  const settings = useSettings()

  // ---- Nhân viên ----
  DEMO_USERS.forEach(([name, roleId, pin], i) =>
    auth.users.push({ id: 'u' + (i + 1), name, roleId, pinHash: hashPin(pin), active: true, createdAt: new Date().toISOString() })
  )
  const U = Object.fromEntries(auth.users.map((u) => [u.roleId, u]))

  PRODUCTS.forEach(([name, category, unit, price, cost, color, track = true, desc = '']) =>
    products.save({ name, category, unit, price, cost, color, desc, stock: track ? int(20, 60) : 0, trackStock: track, minStock: 5 })
  )
  const prodList = products.items.filter((p) => p.category !== 'Dịch vụ')
  const services = products.items.filter((p) => p.category === 'Dịch vụ' && !p.name.startsWith('Phụ thu'))

  NAMES.forEach((name, i) =>
    customers.save({ name, phone: '09' + String(10000000 + i * 7654321).slice(0, 8), address: pick(['Hà Nội', 'TP.HCM', 'Đà Nẵng', 'Đà Lạt', 'Cần Thơ']) })
  )
  ROOMS.forEach(([name, type, floor, price, capacity]) => rooms.saveRoom({ name, type, floor, price, capacity }))

  const today = dateKey()
  const START = 150 // số ngày lịch sử
  const at = (day, h, m) => {
    const d = parseKey(day)
    d.setHours(h, m, int(0, 59))
    return d.toISOString()
  }

  // ---- Hoá đơn bán lẻ lịch sử ----
  const hist = []
  for (let i = START; i >= 0; i--) {
    const day = addDays(today, -i)
    const dow = parseKey(day).getDay()
    const weekend = dow === 0 || dow === 6
    const growth = 1 + (START - i) / START * 0.5 // tăng trưởng nhẹ theo thời gian
    const count = Math.round(int(4, 9) * (weekend ? 1.6 : 1) * growth)
    const nowH = new Date().getHours()
    for (let k = 0; k < count; k++) {
      const h = int(7, 21)
      if (i === 0 && h > nowH) continue
      const lines = []
      const n = int(1, 4)
      for (let j = 0; j < n; j++) {
        const p = R() < 0.06 ? pick(services) : pick(prodList)
        if (lines.find((l) => l.productId === p.id)) continue
        lines.push({ productId: p.id, name: p.name, price: p.price, cost: p.cost, qty: int(1, 3) })
      }
      const cust = R() < 0.3 ? pick(customers.items) : null
      hist.push({
        createdAt: at(day, h, int(0, 59)),
        customerId: cust?.id, customerName: cust?.name,
        items: lines,
        discount: R() < 0.1 ? 10000 : 0,
        method: pick(['cash', 'cash', 'transfer', 'transfer', 'card']),
        skipStock: true,
      })
    }
  }

  // ---- Lịch sử đặt phòng (đã trả) + hoá đơn tiền phòng ----
  rooms.rooms.forEach((room) => {
    let day = addDays(today, -START + int(0, 5))
    while (true) {
      const nights = int(1, 4)
      const out = addDays(day, nights)
      if (out > addDays(today, -3)) break
      const cust = pick(customers.items)
      const b = rooms.saveBooking({ roomId: room.id, customerId: cust.id, guestName: cust.name, phone: cust.phone, checkIn: day, checkOut: out, guests: int(1, room.capacity), deposit: R() < 0.5 ? 200000 : 0 })
      b.status = 'checked_out'
      b.checkedInAt = at(day, 14, 0)
      b.checkedOutAt = at(out, 11, int(0, 59))
      const extras = R() < 0.3 ? [{ productId: services[0].id, name: services[0].name, price: services[0].price, cost: 0, qty: 1 }] : []
      hist.push({
        type: 'room', createdAt: b.checkedOutAt, customerId: cust.id, customerName: cust.name, bookingId: b.id, deposit: b.deposit,
        items: [{ name: `Phòng ${room.name} (${room.type}) × ${nights} đêm`, price: room.price, cost: 0, qty: nights }, ...extras],
        method: pick(['cash', 'transfer', 'transfer', 'card']), skipStock: true, _booking: b,
      })
      day = addDays(out, int(0, 3))
    }
  })

  hist.sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  // ---- Ca làm việc 14 ngày gần nhất: sáng (Lam, 7h–14h) & chiều (Yến, 14h–22h) ----
  const shiftList = []
  for (let i = 13; i >= 0; i--) {
    const day = addDays(today, -i)
    for (const [user, from, to] of [[U.staff, 7, 14], [U.owner, 14, 22]]) {
      if (i === 0 && from > new Date().getHours()) continue
      const sh = {
        id: 'sh-' + day + '-' + from, code: settings.nextCode('CA', 4), userId: user.id, userName: user.name,
        openedAt: at(day, from, 0), openingCash: 1000000, status: 'open', _from: parseKey(day).setHours(from), _to: parseKey(day).setHours(to),
      }
      shiftList.push(sh)
    }
  }
  shifts.items.push(...shiftList.slice().reverse())
  const shiftAt = (iso) => shiftList.find((s) => { const t = new Date(iso).getTime(); return t >= s._from && t < s._to })

  hist.forEach((h) => {
    const sh = shiftAt(h.createdAt)
    const seller = sh ? auth.userById(sh.userId) : U.staff
    const inv = invoices.create({ ...h, shiftId: sh?.id || null, createdById: seller.id, createdByName: seller.name })
    if (h._booking) h._booking.invoiceId = inv.id
  })

  // Đóng các ca đã qua, đếm két lệch vài nghìn cho giống thật
  const nowT = Date.now()
  shiftList.forEach((sh) => {
    const s = shifts.byId(sh.id)
    const end = sh._to
    delete s._from; delete s._to
    if (end > nowT) return // ca đang diễn ra -> để mở
    const sum = shifts.summary(s)
    const diff = pick([0, 0, 0, 0, 0, 0, 0, -10000, 5000, -20000])
    Object.assign(s, {
      status: 'closed', closedAt: new Date(end - int(0, 20) * 60000).toISOString(), closedById: s.userId, closedByName: s.userName,
      expectedCash: sum.expectedCash, countedCash: sum.expectedCash + diff, diff, revenue: sum.revenue, invoiceCount: sum.count,
      closeNote: diff ? 'Lệch do thối tiền lẻ' : '',
    })
  })
  // Nếu không còn ca nào đang mở (ví dụ mở app lúc nửa đêm) thì thôi, nhân viên sẽ tự mở ca


  // ---- Tình trạng hiện tại cho sơ đồ phòng ----
  const [r101, r102, r103, r201, r202, r203, r301] = rooms.rooms // Mây, Nắng, Gió, Thu, Hạ, Đông, Sương
  const c = customers.items
  const stay = (room, cust, inOff, outOff) => {
    const b = rooms.saveBooking({ roomId: room.id, customerId: cust.id, guestName: cust.name, phone: cust.phone, checkIn: addDays(today, inOff), checkOut: addDays(today, outOff), guests: 2, deposit: 300000 })
    b.status = 'staying'
    b.checkedInAt = at(addDays(today, inOff), 14, 10)
    return b
  }
  const book = (room, cust, inOff, outOff) =>
    rooms.saveBooking({ roomId: room.id, customerId: cust.id, guestName: cust.name, phone: cust.phone, checkIn: addDays(today, inOff), checkOut: addDays(today, outOff), guests: 2, deposit: 200000 })

  stay(r101, c[0], -2, 1)
  stay(r201, c[1], -1, 2)
  stay(r301, c[2], 0, 3)
  book(r102, c[3], 0, 2)
  book(r203, c[4], 1, 4)
  book(r202, c[5], 3, 5)
  book(r101, c[6], 2, 4)
  r103.housekeeping = 'dirty'
  r202.housekeeping = 'dirty'
}

/** Vài dòng nhật ký mẫu để màn hình Nhật ký không trống */
function seedAuditSamples() {
  const audit = useAudit()
  const auth = useAuth()
  const today = dateKey()
  const t = (offDay, h, m) => { const d = parseKey(addDays(today, offDay)); d.setHours(h, m); return d.toISOString() }
  const u = (role) => auth.users.find((x) => x.roleId === role)
  const rows = [
    [-2, 7, 2, 'staff', 'login', 'Lam đăng nhập'],
    [-2, 9, 41, 'staff', 'invoice.discount', 'Giảm 30.000 ₫ (25%) cho HD bàn 4', 'owner'],
    [-2, 15, 12, 'staff', 'booking.create', 'Đặt phòng Đông cho khách đoàn'],
    [-1, 10, 5, 'owner', 'product.price', 'Matcha latte: 42.000 → 45.000 ₫'],
    [-1, 11, 30, 'staff', 'room.checkout', 'Trả phòng Hạ'],
    [-1, 12, 10, 'staff', 'room.clean', 'Phòng Hạ đã dọn xong'],
    [-1, 16, 22, 'staff', 'invoice.cancel', 'Huỷ hoá đơn nhập nhầm · Lý do: khách đổi món', 'owner'],
    [-1, 21, 58, 'owner', 'shift.close', 'Đóng ca · lệch -10.000 ₫'],
    [0, 7, 1, 'staff', 'shift.open', 'Mở ca · tiền đầu ca 1.000.000 ₫'],
  ]
  rows.forEach(([d, h, m, role, action, detail, appr]) =>
    audit.log(action, detail, { user: u(role), approvedBy: appr ? u(appr) : null, at: t(d, h, m) })
  )
  audit.entries.sort((a, b) => b.at.localeCompare(a.at))
}

export function initSettings() {
  useSettings()
}
