// ---------- Tiền ----------
const vnd = new Intl.NumberFormat('vi-VN')
export const money = (n) => vnd.format(Math.round(n || 0)) + ' ₫'
export const number = (n) => vnd.format(Math.round(n || 0))
// Rút gọn cho trục biểu đồ: 1.2tr, 350k
export function moneyShort(n) {
  const a = Math.abs(n)
  if (a >= 1e9) return +(n / 1e9).toFixed(1) + ' tỷ'
  if (a >= 1e6) return +(n / 1e6).toFixed(1) + ' tr'
  if (a >= 1e3) return Math.round(n / 1e3) + 'k'
  return String(Math.round(n))
}

// ---------- Ngày giờ (theo giờ máy) ----------
const pad = (n) => String(n).padStart(2, '0')
/** Date -> 'YYYY-MM-DD' theo giờ địa phương */
export const dateKey = (d = new Date()) => {
  d = new Date(d)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
/** 'YYYY-MM-DD' -> Date 00:00 giờ địa phương */
export const parseKey = (k) => {
  const [y, m, d] = k.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const addDays = (k, n) => {
  const d = parseKey(k)
  d.setDate(d.getDate() + n)
  return dateKey(d)
}
export const diffDays = (a, b) => Math.round((parseKey(b) - parseKey(a)) / 86400000)
export const fmtDate = (d) => {
  d = typeof d === 'string' && d.length === 10 ? parseKey(d) : new Date(d)
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}
export const fmtDateTime = (d) => {
  d = new Date(d)
  return `${fmtDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
export const fmtTime = (d) => {
  d = new Date(d)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const WD = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
export const weekday = (k) => WD[parseKey(k).getDay()]
export const monthKey = (d = new Date()) => dateKey(d).slice(0, 7)

// ---------- Khác ----------
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
export const pct = (cur, prev) => (prev ? ((cur - prev) / prev) * 100 : null)
export function toCsv(rows) {
  const esc = (v) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return '﻿' + rows.map((r) => r.map(esc).join(',')).join('\n')
}
export function download(filename, content, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click()
  URL.revokeObjectURL(url)
}
/** Bỏ dấu tiếng Việt để tìm kiếm: "Cà phê" -> "ca phe" */
export const normalize = (s = '') =>
  s.toString().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()
