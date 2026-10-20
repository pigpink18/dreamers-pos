/**
 * ĐỒNG BỘ DỮ LIỆU VỚI MÁY CHỦ (Supabase)
 *
 * Ý tưởng: app vẫn đọc/ghi localStorage như cũ (chạy được khi mất mạng).
 * Bộ đồng bộ đứng giữa:
 *   - Theo dõi từng "bộ sưu tập" (products, invoices…). Khi có thay đổi → tính phần khác biệt theo từng bản ghi
 *     → đưa vào hàng đợi (outbox, lưu trong localStorage) → đẩy lên bảng `docs` khi có mạng.
 *   - Nhận thay đổi từ máy khác qua Realtime → áp vào dữ liệu trên máy này.
 *   - Cứ mỗi phút kéo bù những gì bị lỡ (VD lúc mất mạng).
 *
 * Bảng `docs`: (collection, id) → data jsonb, deleted, updated_at, device
 * Bộ sưu tập dạng mảng: mỗi phần tử có `id` là 1 bản ghi. Dạng object (shop, counters…): 1 bản ghi id = '_'.
 * Xung đột: bản ghi nào ghi sau thắng. Riêng `counters` lấy số lớn nhất để mã hoá đơn không bị trùng.
 */
import { reactive, watch, toRaw } from 'vue'

export const SYNC_KEYS = [
  'users', 'roles', 'products', 'imports', 'customers', 'invoices', 'rooms', 'bookings', 'shifts', 'audit',
  'shop', 'counters', 'ops', 'payment', 'einvoice', 'channels',
]
const SINGLE = '_'
// Danh sách mới nhất nằm đầu (hoá đơn, nhật ký…); còn lại giữ thứ tự thêm vào (menu, phòng…)
const NEWEST_FIRST = ['invoices', 'audit', 'customers', 'imports', 'shifts']
const timeOf = (d) => d?.createdAt || d?.at || d?.openedAt || d?.date || ''
const PAGE = 1000

export function createSyncEngine({ storage = globalThis.localStorage, prefix = 'dreamers:sync:', deviceId } = {}) {
  const registry = new Map() // key -> ref
  const snap = new Map() // key -> Map(id -> json)
  let client = null
  let channel = null
  let pollTimer = null
  let flushing = false
  const timers = {}

  const device = deviceId || storage.getItem(prefix + 'device') || (() => {
    const id = 'dev-' + Math.random().toString(36).slice(2, 10)
    storage.setItem(prefix + 'device', id)
    return id
  })()

  const status = reactive({ state: 'off', pending: 0, lastSync: storage.getItem(prefix + 'lastSync'), error: '', device })

  // ---------- Hàng đợi gửi đi ----------
  const loadOutbox = () => { try { return JSON.parse(storage.getItem(prefix + 'outbox')) || {} } catch { return {} } }
  let outbox = loadOutbox() // "collection|id" -> row (chỉ giữ bản mới nhất)
  const saveOutbox = () => { storage.setItem(prefix + 'outbox', JSON.stringify(outbox)); status.pending = Object.keys(outbox).length }
  status.pending = Object.keys(outbox).length

  // ---------- Ảnh chụp để so khác biệt ----------
  const isArr = (key) => Array.isArray(registry.get(key)?.value)
  function snapshotOf(key) {
    const v = toRaw(registry.get(key).value)
    const m = new Map()
    if (Array.isArray(v)) v.forEach((d) => d && d.id != null && m.set(String(d.id), JSON.stringify(d)))
    else if (v != null) m.set(SINGLE, JSON.stringify(v))
    return m
  }

  function orderOf(key) {
    const v = toRaw(registry.get(key).value)
    const m = new Map()
    if (Array.isArray(v)) v.forEach((d, i) => d?.id != null && m.set(String(d.id), i))
    return m
  }

  function diff(key) {
    const prev = snap.get(key) || new Map()
    const cur = snapshotOf(key)
    const rows = []
    const order = orderOf(key)
    cur.forEach((json, id) => { if (prev.get(id) !== json) rows.push({ collection: key, id, data: JSON.parse(json), deleted: false, ord: order.get(id) ?? 0 }) })
    prev.forEach((_, id) => { if (!cur.has(id)) rows.push({ collection: key, id, data: null, deleted: true }) })
    snap.set(key, cur)
    return rows
  }

  function queue(rows) {
    if (!rows.length) return
    rows.forEach((r) => (outbox[r.collection + '|' + r.id] = { ...r, device }))
    saveOutbox()
    flush()
  }

  /** Gọi từ useStorage(): đăng ký 1 bộ sưu tập để đồng bộ */
  function register(key, ref) {
    if (!SYNC_KEYS.includes(key) || registry.has(key)) return
    registry.set(key, ref)
    snap.set(key, snapshotOf(key))
    watch(ref, () => {
      clearTimeout(timers[key])
      timers[key] = setTimeout(() => queue(diff(key)), 250)
    }, { deep: true })
  }

  // ---------- Áp thay đổi từ máy chủ ----------
  function apply(row) {
    const key = row.collection
    const ref = registry.get(key)
    if (!ref) return
    if (key !== 'counters' && outbox[key + '|' + row.id]) return // máy này đang có sửa chưa gửi -> giữ bản của máy này
    const s = snap.get(key) || new Map()
    if (row.id === SINGLE && !Array.isArray(ref.value)) {
      if (row.deleted || !row.data) return
      let data = row.data
      if (key === 'counters') {
        // Lấy số lớn nhất của 2 bên. Ảnh chụp ghi theo bản máy chủ -> nếu máy này lớn hơn,
        // bộ theo dõi sẽ thấy khác và tự gửi số lớn hơn lên (máy chủ không bao giờ bị lùi số).
        data = { ...ref.value }
        Object.entries(row.data).forEach(([k, v]) => (data[k] = Math.max(+data[k] || 0, +v || 0)))
        s.set(SINGLE, JSON.stringify(row.data))
        snap.set(key, s)
        delete outbox[key + '|' + SINGLE]
        saveOutbox()
        ref.value = data
        return
      }
      s.set(SINGLE, JSON.stringify(data))
      snap.set(key, s)
      ref.value = data
      return
    }
    const arr = ref.value
    const i = arr.findIndex((d) => String(d.id) === row.id)
    if (row.deleted) {
      s.delete(row.id)
      if (i >= 0) arr.splice(i, 1)
    } else {
      s.set(row.id, JSON.stringify(row.data))
      if (i >= 0) arr.splice(i, 1, row.data)
      else if (NEWEST_FIRST.includes(key)) arr.unshift(row.data)
      else arr.push(row.data)
    }
    snap.set(key, s)
  }

  /** Thay toàn bộ dữ liệu trên máy bằng dữ liệu máy chủ */
  function replaceAll(rows) {
    const by = {}
    rows.forEach((r) => { if (!r.deleted) (by[r.collection] ||= []).push(r) })
    registry.forEach((ref, key) => {
      const list = by[key] || []
      if (Array.isArray(ref.value)) {
        if (NEWEST_FIRST.includes(key)) list.sort((a, b) => timeOf(b.data).localeCompare(timeOf(a.data)))
        else list.sort((a, b) => (a.ord ?? 0) - (b.ord ?? 0))
        ref.value = list.map((r) => r.data)
      } else if (list[0]) ref.value = list[0].data
      snap.set(key, snapshotOf(key))
    })
    outbox = {}
    saveOutbox()
  }

  // ---------- Giao tiếp máy chủ ----------
  let flushP = null
  /** Gửi hàng đợi lên máy chủ (gọi chồng nhau vẫn an toàn — dùng chung 1 lượt gửi) */
  function flush() {
    if (!client || status.state === 'off') return Promise.resolve()
    if (flushP) return flushP
    flushP = (async () => {
      try {
        let rows
        while ((rows = Object.values(outbox)).length) {
          const chunk = rows.slice(0, 500).map(({ collection, id, data, deleted, ord }) => ({ collection, id, data, deleted, ord: ord ?? 0, device }))
          const { error } = await client.from('docs').upsert(chunk, { onConflict: 'collection,id' })
          if (error) throw error
          let removed = 0
          chunk.forEach((r) => {
            const k = r.collection + '|' + r.id
            // chỉ xoá khỏi hàng đợi nếu chưa bị sửa tiếp trong lúc gửi
            if (outbox[k] && JSON.stringify(outbox[k].data) === JSON.stringify(r.data) && outbox[k].deleted === r.deleted) { delete outbox[k]; removed++ }
          })
          saveOutbox()
          if (!removed) break
        }
        setOnline()
      } catch (e) {
        setOffline(e)
      }
    })().finally(() => (flushP = null))
    return flushP
  }

  async function fetchSince(since) {
    const out = []
    for (let from = 0; ; from += PAGE) {
      let q = client.from('docs').select('collection,id,data,deleted,ord,updated_at,device')
      if (since) q = q.gt('updated_at', since)
      const { data, error } = await q.order('updated_at', { ascending: true }).range(from, from + PAGE - 1)
      if (error) throw error
      out.push(...data)
      if (data.length < PAGE) break
    }
    return out
  }

  function markPulled(rows) {
    const last = rows.reduce((m, r) => (r.updated_at > m ? r.updated_at : m), storage.getItem(prefix + 'cursor') || '')
    if (last) storage.setItem(prefix + 'cursor', last)
    status.lastSync = new Date().toISOString()
    storage.setItem(prefix + 'lastSync', status.lastSync)
  }

  async function pull() {
    if (!client) return
    try {
      // lùi con trỏ 30 giây để không sót bản ghi ghi cùng lúc (áp lại nhiều lần vẫn an toàn)
      const cur = storage.getItem(prefix + 'cursor')
      const since = cur ? new Date(new Date(cur).getTime() - 30000).toISOString() : null
      const rows = await fetchSince(since)
      rows.filter((r) => r.device !== device).forEach(apply)
      markPulled(rows)
      setOnline()
    } catch (e) { setOffline(e) }
  }

  /** Máy chủ đã có dữ liệu chưa? (để hỏi người dùng lần kết nối đầu) */
  async function remoteCount(c = client) {
    const { count, error } = await c.from('docs').select('id', { count: 'exact', head: true })
    if (error) throw error
    return count || 0
  }

  /**
   * Bắt đầu đồng bộ
   * mode 'resume' — đã từng đồng bộ trên máy này: gửi hàng đợi + kéo phần mới
   * mode 'pull'   — lấy toàn bộ dữ liệu máy chủ thay cho dữ liệu máy này (máy thứ 2, 3…)
   * mode 'push'   — đưa toàn bộ dữ liệu máy này lên máy chủ (máy đầu tiên)
   */
  async function start(supabase, mode = 'resume') {
    client = supabase
    status.state = 'connecting'
    status.error = ''
    try {
      if (mode === 'pull') {
        const rows = await fetchSince(null)
        replaceAll(rows)
        storage.removeItem(prefix + 'cursor')
        markPulled(rows)
      } else if (mode === 'push') {
        const rows = []
        registry.forEach((_, key) => { const order = orderOf(key); snapshotOf(key).forEach((json, id) => rows.push({ collection: key, id, data: JSON.parse(json), deleted: false, ord: order.get(id) ?? 0 })) })
        outbox = {}
        rows.forEach((r) => (outbox[r.collection + '|' + r.id] = { ...r, device }))
        saveOutbox()
        await flush()
        if (Object.keys(outbox).length) throw new Error(status.error || 'Chưa gửi hết dữ liệu lên máy chủ')
        await pull()
      } else {
        await flush()
        await pull()
      }
      storage.setItem(prefix + 'started', '1')
      subscribe()
      clearInterval(pollTimer)
      pollTimer = setInterval(() => { flush(); pull() }, 60000)
      setOnline()
    } catch (e) {
      setOffline(e)
      throw e
    }
  }

  function subscribe() {
    if (!client?.channel) return
    if (channel) client.removeChannel(channel)
    channel = client
      .channel('docs-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'docs' }, (payload) => {
        const r = payload.new
        if (!r || r.device === device) return
        apply(r)
        markPulled([r])
      })
      .subscribe()
  }

  function stop() {
    clearInterval(pollTimer)
    if (channel && client) client.removeChannel(channel)
    channel = null
    client = null
    status.state = 'off'
  }
  /** Ngắt hẳn: quên con trỏ đồng bộ (lần sau kết nối sẽ hỏi lại pull/push) */
  function reset() {
    stop()
    ;['cursor', 'started', 'lastSync'].forEach((k) => storage.removeItem(prefix + k))
    outbox = {}
    saveOutbox()
    status.lastSync = null
  }

  function setOnline() { if (client) { status.state = 'online'; status.error = '' } }
  function setOffline(e) {
    status.state = 'offline'
    status.error = e?.message || String(e || '')
  }

  const hasStarted = () => storage.getItem(prefix + 'started') === '1'

  return { register, start, stop, reset, flush, pull, remoteCount, hasStarted, status, registry, isArr, _apply: apply }
}

// Bộ đồng bộ dùng chung cho app
export const sync = createSyncEngine()
