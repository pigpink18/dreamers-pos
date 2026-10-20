import { ref, watch } from 'vue'
import { sync } from '../sync/engine'

const PREFIX = 'dreamers:'

/**
 * ref() tự đồng bộ với localStorage.
 * Khi đã kết nối máy chủ, src/sync/engine.js tự đồng bộ các ref này với Supabase.
 */
export function useStorage(key, fallback) {
  let initial = fallback
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (raw !== null) initial = JSON.parse(raw)
  } catch (e) {
    console.warn('Không đọc được dữ liệu', key, e)
  }
  const state = ref(initial)
  watch(state, (val) => localStorage.setItem(PREFIX + key, JSON.stringify(val)), { deep: true })
  sync.register(key, state) // dùng chung dữ liệu giữa các máy khi đã kết nối máy chủ (src/sync)
  return state
}

export const hasData = () => localStorage.getItem(PREFIX + 'seeded') !== null
export const markSeeded = () => localStorage.setItem(PREFIX + 'seeded', '1')
/** Xoá dữ liệu; keep = danh sách khoá muốn giữ lại (VD: ['users', 'roles']) */
export function clearAll(keep = []) {
  Object.keys(localStorage)
    .filter((k) => k.startsWith(PREFIX) && !keep.includes(k.slice(PREFIX.length)))
    .forEach((k) => localStorage.removeItem(k))
}
export function exportAll() {
  const out = {}
  Object.keys(localStorage)
    .filter((k) => k.startsWith(PREFIX))
    .forEach((k) => (out[k.slice(PREFIX.length)] = JSON.parse(localStorage.getItem(k))))
  return out
}
export function importAll(obj) {
  clearAll()
  Object.entries(obj).forEach(([k, v]) => localStorage.setItem(PREFIX + k, JSON.stringify(v)))
}
