/**
 * TÀI KHOẢN CHỦ QUÁN + MÁY CHỦ (Supabase, hệ thống nhiều quán)
 *
 * - Máy chủ: 1 dự án Supabase dùng chung cho mọi quán. Địa chỉ + khoá công khai (anon key) lấy từ
 *   file .env khi build (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) hoặc nhập tay trên máy (Cài đặt › Tài khoản).
 * - Chủ quán đăng ký / đăng nhập bằng email + mật khẩu. Supabase tự giữ phiên đăng nhập trên máy.
 * - Sau khi chọn quán, bộ đồng bộ (engine.js) chỉ trao đổi dữ liệu của đúng quán đó.
 */
import { createClient } from '@supabase/supabase-js'
import { sync } from './engine'
import { activeShopId } from '../tenant'

const PLATFORM = 'dreamers:platform'
let client = null

// Chấp nhận cả khi lỡ dán nguyên dòng "TEN_BIEN=giá trị" hoặc có dấu ngoặc / khoảng trắng
const clean = (v) => String(v || '').trim().replace(/^[A-Z0-9_]+\s*=\s*/, '').replace(/^["']|["']$/g, '').trim().replace(/\/$/, '')
const ENV_URL = clean(import.meta.env.VITE_SUPABASE_URL)
const ENV_KEY = clean(import.meta.env.VITE_SUPABASE_ANON_KEY)

/** Cấu hình máy chủ: { url, key, fromEnv } hoặc null nếu chưa cài */
export function getPlatform() {
  if (ENV_URL && ENV_KEY) return { url: ENV_URL, key: ENV_KEY, fromEnv: true }
  try {
    const c = JSON.parse(localStorage.getItem(PLATFORM))
    return c?.url && c?.key ? { ...c, fromEnv: false } : null
  } catch { return null }
}
export const platformOn = () => !!getPlatform()
/** Cài máy chủ bằng tay trên máy này (khi bản build chưa có .env) */
export function setPlatform({ url, key }) {
  url = String(url || '').trim().replace(/\/$/, '')
  key = String(key || '').trim()
  if (!/^https:\/\/.+/.test(url)) throw new Error('Địa chỉ máy chủ phải bắt đầu bằng https://')
  if (key.length < 20) throw new Error('Khoá công khai (anon key) không đúng')
  localStorage.setItem(PLATFORM, JSON.stringify({ url, key }))
  client = null
}
// tương thích các phần cũ (kênh iCal) đang đọc getConfig().url
export const getConfig = () => getPlatform()

export function getClient() {
  if (client) return client
  const p = getPlatform()
  if (!p) return null
  client = createClient(p.url, p.key, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'dreamers-sb-auth' },
    realtime: { params: { eventsPerSecond: 20 } },
  })
  return client
}

const viError = (e) => {
  const m = e?.message || String(e || '')
  if (/Invalid login credentials/i.test(m)) return 'Sai email hoặc mật khẩu'
  if (/already registered|already been registered|User already/i.test(m)) return 'Email này đã có tài khoản — chọn "Đăng nhập"'
  if (/Email not confirmed/i.test(m)) return 'Email chưa được xác nhận — mở hộp thư và bấm link xác nhận'
  if (/Password should be at least/i.test(m)) return 'Mật khẩu cần ít nhất 6 ký tự'
  if (/valid email|invalid format|Unable to validate email/i.test(m)) return 'Email không hợp lệ'
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Không kết nối được máy chủ — kiểm tra mạng'
  if (/signups not allowed|Signups not allowed/i.test(m)) return 'Hệ thống đang tạm ngừng nhận đăng ký mới'
  return m
}

function need() {
  const c = getClient()
  if (!c) throw new Error('Chưa cài máy chủ')
  return c
}

export async function getSession() {
  const c = getClient()
  if (!c) return null
  const { data } = await c.auth.getSession()
  return data?.session || null
}

export async function signIn(email, password) {
  const { data, error } = await need().auth.signInWithPassword({ email: String(email).trim(), password })
  if (error) throw new Error(viError(error))
  return data.session
}

/** Đăng ký: trả về { session } (dùng ngay) hoặc { needConfirm: true } nếu máy chủ bắt xác nhận email */
export async function signUp(email, password) {
  const { data, error } = await need().auth.signUp({ email: String(email).trim(), password })
  if (error) throw new Error(viError(error))
  // Supabase trả user không có danh tính khi email đã tồn tại (để không lộ email nào đã đăng ký)
  if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) throw new Error(viError({ message: 'User already registered' }))
  return data.session ? { session: data.session } : { needConfirm: true }
}

/** scope 'global' = đăng xuất tài khoản trên MỌI máy (khi mất điện thoại / lộ mật khẩu) */
export async function signOut(scope = 'local') {
  sync.stop()
  const c = getClient()
  if (c) await c.auth.signOut({ scope }).catch(() => {})
}

/** Các quán tài khoản này được vào (máy chủ chỉ trả quán mình là thành viên) */
export async function listShops() {
  const { data, error } = await need().from('shops').select('id,name,created_at').order('created_at', { ascending: true })
  if (error) throw new Error(viError(error))
  return data || []
}

export async function createShop(name) {
  const { data, error } = await need().rpc('create_shop', { p_name: String(name).trim() })
  if (error) throw new Error(viError(error))
  return { id: data, name: String(name).trim() }
}

export async function renameShop(id, name) {
  const { error } = await need().from('shops').update({ name: String(name).trim() }).eq('id', id)
  if (error) throw new Error(viError(error))
}

/** Bắt đầu đồng bộ quán đang mở. mode: 'push' (quán vừa tạo) | 'pull' (máy mới vào quán) | 'resume' */
export async function startSync(mode = 'resume') {
  if (!activeShopId) throw new Error('Chưa chọn quán')
  await sync.start(need(), mode)
}

/** Mở app: tự đồng bộ quán đang mở nếu còn phiên đăng nhập */
export async function autoStart() {
  if (!activeShopId || !getClient()) return
  const session = await getSession()
  if (!session) {
    sync.status.state = 'offline'
    sync.status.error = 'Phiên đăng nhập tài khoản đã hết — vào Cài đặt › Tài khoản để đăng nhập lại'
    return
  }
  try { await sync.start(getClient(), 'resume') } catch { /* trạng thái đã ghi vào sync.status, sẽ thử lại khi có mạng */ }
  window.addEventListener('online', () => sync.start(getClient(), 'resume').catch(() => {}))
}

export async function disconnect() { await signOut() }
