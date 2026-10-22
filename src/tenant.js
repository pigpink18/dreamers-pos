/**
 * QUÁN ĐANG MỞ TRÊN MÁY NÀY (hệ thống nhiều quán)
 *
 * Mỗi quán có vùng dữ liệu riêng trên máy: khoá localStorage dạng  dreamers:s:<mã quán>:<tên dữ liệu>
 * Chế độ cũ (chưa cài máy chủ / chưa chọn quán): dữ liệu nằm ở  dreamers:<tên dữ liệu>  như trước.
 *
 * Quán được chọn 1 lần khi mở app (đổi quán = tải lại trang), nên mọi store đọc đúng vùng dữ liệu từ đầu.
 */
const ACTIVE_KEY = 'dreamers:activeShop'
export const LEGACY_PREFIX = 'dreamers:'
/** Khoá dùng chung cho cả máy, không thuộc quán nào */
export const DEVICE_KEYS = ['activeShop', 'platform', 'appearance']
const GLOBAL_KEYS = ['appearance'] // giao diện (sáng/tối, kiểu menu) theo máy, không theo quán

function readActive() {
  try {
    const v = JSON.parse(localStorage.getItem(ACTIVE_KEY))
    return v && typeof v.id === 'string' && /^[0-9a-f-]{8,}$/i.test(v.id) ? v : null
  } catch { return null }
}

/** { id, name } quán đang mở, hoặc null (chế độ 1 máy cũ) */
export const activeShop = readActive()
export const activeShopId = activeShop?.id || null
export const isLegacy = !activeShopId

export const shopPrefix = (id) => `${LEGACY_PREFIX}s:${id}:`
/** Tiền tố khoá dữ liệu của quán đang mở */
export const PREFIX = activeShopId ? shopPrefix(activeShopId) : LEGACY_PREFIX

/** Khoá localStorage đầy đủ cho 1 tên dữ liệu của quán đang mở */
export const nsKey = (k) => (GLOBAL_KEYS.includes(k) ? LEGACY_PREFIX : PREFIX) + k

/** Khoá có thuộc vùng dữ liệu của quán đang mở không (để xoá / sao lưu đúng phần của quán) */
export function ownsKey(fullKey) {
  if (!fullKey.startsWith(PREFIX)) return false
  if (!isLegacy) return true
  const rest = fullKey.slice(LEGACY_PREFIX.length)
  return !rest.startsWith('s:') && !DEVICE_KEYS.includes(rest)
}

/** Chọn quán để mở (lần tải trang sau sẽ dùng vùng dữ liệu của quán này). null = bỏ chọn */
export function setActiveShop(shop) {
  if (shop?.id) localStorage.setItem(ACTIVE_KEY, JSON.stringify({ id: shop.id, name: shop.name || '' }))
  else localStorage.removeItem(ACTIVE_KEY)
}

/** Xoá toàn bộ dữ liệu của 1 quán trên máy này (dữ liệu trên máy chủ không bị ảnh hưởng) */
export function forgetShopData(id) {
  const p = shopPrefix(id)
  Object.keys(localStorage).filter((k) => k.startsWith(p)).forEach((k) => localStorage.removeItem(k))
}

/** Máy này có dữ liệu cũ (chế độ 1 máy, trước khi có tài khoản) không */
export const hasLegacyData = () => localStorage.getItem(LEGACY_PREFIX + 'seeded') !== null

/** Chép dữ liệu chế độ 1 máy cũ sang vùng của 1 quán (dùng khi chủ quán đưa dữ liệu đang có lên quán mới) */
export function copyLegacyInto(id) {
  const p = shopPrefix(id)
  Object.keys(localStorage)
    .filter((k) => k.startsWith(LEGACY_PREFIX))
    .forEach((k) => {
      const rest = k.slice(LEGACY_PREFIX.length)
      if (rest.startsWith('s:') || rest.startsWith('sync:') || DEVICE_KEYS.includes(rest) || rest === 'wantDemo') return
      localStorage.setItem(p + rest, localStorage.getItem(k))
    })
}

/** Tên ngắn không dấu để ghi vào nội dung chuyển khoản (VD "Dreamers Home & Coffee" -> "Dreamers") */
export function transferTag(name) {
  const s = String(name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
  return (s.replace(/[^A-Za-z0-9 ]/g, ' ').trim().split(/\s+/)[0] || '').slice(0, 15)
}

/** Đã cài máy chủ (hệ thống nhiều quán) chưa — kiểm tra nhanh, không cần tải thư viện Supabase */
export const platformConfigured = () =>
  !!((import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) || localStorage.getItem(LEGACY_PREFIX + 'platform'))
