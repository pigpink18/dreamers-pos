/**
 * Kết nối Supabase: lưu cấu hình, đăng nhập tài khoản cửa hàng, khởi động bộ đồng bộ.
 * Cấu hình (URL + anon key + email) lưu trên máy; mật khẩu KHÔNG lưu — Supabase tự giữ phiên đăng nhập.
 */
import { createClient } from '@supabase/supabase-js'
import { sync } from './engine'

const CFG = 'dreamers:sync:config'
let client = null

export const getConfig = () => { try { return JSON.parse(localStorage.getItem(CFG)) } catch { return null } }
const saveConfig = (c) => localStorage.setItem(CFG, JSON.stringify(c))
export const getClient = () => client

function makeClient({ url, key }) {
  client = createClient(url.trim().replace(/\/$/, ''), key.trim(), {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'dreamers-sb-auth' },
    realtime: { params: { eventsPerSecond: 20 } },
  })
  return client
}

/**
 * Bước 1: đăng nhập. Trả về { remote: số bản ghi trên máy chủ, needChoice }
 * needChoice = máy chủ đã có dữ liệu và máy này chưa từng đồng bộ → hỏi người dùng lấy dữ liệu bên nào
 */
export async function connect({ url, key, email, password }) {
  if (!/^https:\/\/.+/.test(url || '')) throw new Error('URL máy chủ phải bắt đầu bằng https://')
  const c = makeClient({ url, key })
  const { error } = await c.auth.signInWithPassword({ email: email.trim(), password })
  if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Sai email hoặc mật khẩu' : error.message)
  saveConfig({ url: url.trim(), key: key.trim(), email: email.trim(), enabled: true })
  const remote = await sync.remoteCount(c)
  return { remote, needChoice: remote > 0 && !sync.hasStarted() }
}

/** Bước 2: bắt đầu đồng bộ. mode: 'push' (máy đầu tiên) | 'pull' (máy thứ 2…) | 'resume' */
export async function startSync(mode) {
  if (!client) throw new Error('Chưa kết nối máy chủ')
  await sync.start(client, mode)
}

/** Mở app: tự nối lại nếu đã cấu hình và còn phiên đăng nhập */
export async function autoStart() {
  const cfg = getConfig()
  if (!cfg?.enabled || !cfg.url || !cfg.key) return
  const c = makeClient(cfg)
  const { data } = await c.auth.getSession()
  if (!data?.session) { sync.status.state = 'offline'; sync.status.error = 'Phiên đăng nhập máy chủ đã hết — vào Cài đặt › Máy chủ để đăng nhập lại'; return }
  if (!sync.hasStarted()) return // chưa chọn kéo/đẩy lần đầu
  try { await sync.start(c, 'resume') } catch { /* trạng thái đã ghi vào sync.status, sẽ thử lại khi có mạng */ }
  window.addEventListener('online', () => sync.start(c, 'resume').catch(() => {}))
}

export async function disconnect() {
  sync.reset()
  if (client) await client.auth.signOut().catch(() => {})
  client = null
  const cfg = getConfig()
  if (cfg) saveConfig({ ...cfg, enabled: false })
}
