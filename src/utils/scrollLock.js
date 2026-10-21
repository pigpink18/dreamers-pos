/**
 * Khoá cuộn trang phía sau khi có popup / bảng trượt đang mở.
 * Đếm số popup: popup cuối cùng đóng thì mới mở khoá.
 */
let count = 0
export function lockScroll() {
  if (count++ === 0) document.documentElement.classList.add('scroll-locked')
}
export function unlockScroll() {
  count = Math.max(0, count - 1)
  if (count === 0) document.documentElement.classList.remove('scroll-locked')
}
