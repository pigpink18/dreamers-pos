import { dateKey, parseKey, addDays, fmtDate } from './format'

export const MODES = { day: 'Ngày', month: 'Tháng', quarter: 'Quý', year: 'Năm' }

/** Giá trị mặc định cho bộ chọn kỳ */
export function defaultRef(mode, d = new Date()) {
  const y = d.getFullYear()
  if (mode === 'day') return dateKey(d)
  if (mode === 'month') return dateKey(d).slice(0, 7)
  if (mode === 'quarter') return `${y}-Q${Math.floor(d.getMonth() / 3) + 1}`
  return String(y)
}

/** Lùi/tiến 1 kỳ */
export function shiftRef(mode, ref, step) {
  if (mode === 'day') return addDays(ref, step)
  if (mode === 'month') {
    const [y, m] = ref.split('-').map(Number)
    return defaultRef('month', new Date(y, m - 1 + step, 1))
  }
  if (mode === 'quarter') {
    const [y, q] = ref.split('-Q').map(Number)
    return defaultRef('quarter', new Date(y, (q - 1 + step) * 3, 1))
  }
  return String(+ref + step)
}

/**
 * Trả về khoảng thời gian [start, end) và danh sách "cột" (bucket) của biểu đồ
 */
export function buildRange(mode, ref) {
  let start, end, label, buckets = []
  if (mode === 'day') {
    start = parseKey(ref)
    end = parseKey(addDays(ref, 1))
    label = `Ngày ${fmtDate(ref)}`
    for (let h = 0; h < 24; h++) {
      const s = new Date(start); s.setHours(h)
      const e = new Date(start); e.setHours(h + 1)
      buckets.push({ key: h, label: `${h}h`, full: `${h}:00 – ${h + 1}:00`, start: s, end: e })
    }
  } else if (mode === 'month') {
    const [y, m] = ref.split('-').map(Number)
    start = new Date(y, m - 1, 1)
    end = new Date(y, m, 1)
    label = `Tháng ${m}/${y}`
    for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
      const s = new Date(d), e = new Date(d); e.setDate(e.getDate() + 1)
      buckets.push({ key: dateKey(s), label: String(s.getDate()), full: fmtDate(s), start: s, end: e })
    }
  } else if (mode === 'quarter') {
    const [y, q] = ref.split('-Q').map(Number)
    start = new Date(y, (q - 1) * 3, 1)
    end = new Date(y, q * 3, 1)
    label = `Quý ${q}/${y}`
    // Chia tuần 7 ngày; phần lẻ cuối quý (< 4 ngày) gộp vào tuần cuối
    const short = (d) => fmtDate(d).slice(0, 5)
    let i = 1
    for (let d = new Date(start); d < end; i++) {
      const s = new Date(d)
      let e = new Date(d); e.setDate(e.getDate() + 7)
      const rest = (end - e) / 86400000
      if (e > end || rest < 4) e = new Date(end)
      const last = new Date(e); last.setDate(last.getDate() - 1)
      buckets.push({ key: i, label: `T${i}`, full: `Tuần ${i} (${short(s)} – ${short(last)})`, start: s, end: e })
      d = e
    }
  } else {
    const y = +ref
    start = new Date(y, 0, 1)
    end = new Date(y + 1, 0, 1)
    label = `Năm ${y}`
    for (let m = 0; m < 12; m++)
      buckets.push({ key: m + 1, label: `Th${m + 1}`, full: `Tháng ${m + 1}/${y}`, start: new Date(y, m, 1), end: new Date(y, m + 1, 1) })
  }
  return { mode, ref, start, end, label, buckets }
}

const lineCost = (l) => (l.cost || 0) * l.qty

/** Tổng hợp số liệu hoá đơn trong 1 khoảng */
export function aggregate(invoices, range) {
  const s = range.start.getTime(), e = range.end.getTime()
  const list = invoices.filter((i) => {
    const t = new Date(i.createdAt).getTime()
    return i.status === 'completed' && t >= s && t < e
  })

  const res = {
    list,
    count: list.length,
    revenue: 0, retail: 0, room: 0, discount: 0, cost: 0,
    retailCount: 0, roomCount: 0,
    methods: { cash: 0, transfer: 0, card: 0 },
    buckets: range.buckets.map((b) => ({ ...b, retail: 0, room: 0, total: 0, count: 0 })),
    products: {},
  }
  const bs = res.buckets.map((b) => [b.start.getTime(), b.end.getTime()])

  for (const inv of list) {
    const t = new Date(inv.createdAt).getTime()
    res.revenue += inv.total
    res.discount += inv.discount
    res[inv.type] += inv.total
    res[inv.type + 'Count']++
    res.methods[inv.method] = (res.methods[inv.method] || 0) + inv.total
    res.cost += inv.items.reduce((a, l) => a + lineCost(l), 0)
    const bi = bs.findIndex(([a, b]) => t >= a && t < b)
    if (bi >= 0) {
      const b = res.buckets[bi]
      b[inv.type] += inv.total
      b.total += inv.total
      b.count++
    }
    if (inv.type === 'retail')
      for (const l of inv.items) {
        const k = l.productId || l.name
        const p = (res.products[k] ||= { name: l.name, qty: 0, revenue: 0, profit: 0 })
        p.qty += l.qty
        p.revenue += l.price * l.qty
        p.profit += (l.price - (l.cost || 0)) * l.qty
      }
  }
  res.profit = res.revenue - res.cost
  res.avg = res.count ? res.revenue / res.count : 0
  res.topProducts = Object.values(res.products).sort((a, b) => b.revenue - a.revenue)
  return res
}

/**
 * Kỳ trước để so sánh "cùng kỳ": nếu kỳ hiện tại đang diễn ra (VD: mới tới ngày 15),
 * kỳ trước cũng chỉ lấy tới mốc tương ứng (ngày 15 tháng trước) cho công bằng.
 */
export function comparableRange(mode, ref, now = new Date()) {
  const cur = buildRange(mode, ref)
  const prev = buildRange(mode, shiftRef(mode, ref, -1))
  if (now > cur.start && now < cur.end) {
    const elapsed = now - cur.start
    prev.end = new Date(Math.min(prev.end.getTime(), prev.start.getTime() + elapsed))
    prev.partial = true
  }
  return prev
}
