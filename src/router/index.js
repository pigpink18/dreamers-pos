import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuth } from '../stores/auth'

/**
 * Danh sách trang + menu.
 * meta.perm: quyền cần có để vào trang (xem stores/auth.js). Không có perm = ai đăng nhập cũng vào được.
 * meta.public: không cần đăng nhập. meta.bare: không hiện khung menu.
 */
const routes = [
  { path: '/login', name: 'login', component: () => import('../views/LoginView.vue'), meta: { title: 'Đăng nhập', public: true, bare: true, hidden: true } },
  { path: '/', name: 'dashboard', component: () => import('../views/DashboardView.vue'), meta: { title: 'Tổng quan', icon: 'dashboard', perm: 'dashboard.view' } },
  { path: '/pos', name: 'pos', component: () => import('../views/PosView.vue'), meta: { title: 'Bán hàng', icon: 'pos', full: true, perm: 'pos.sell' } },
  { path: '/invoices', name: 'invoices', component: () => import('../views/InvoicesView.vue'), meta: { title: 'Hoá đơn', icon: 'receipt', perm: 'invoices.view' } },
  { path: '/rooms', name: 'rooms', component: () => import('../views/RoomsView.vue'), meta: { title: 'Sơ đồ phòng', tab: 'Phòng', icon: 'bed', group: 'Homestay', perm: 'rooms.view' } },
  { path: '/bookings', name: 'bookings', component: () => import('../views/BookingCalendarView.vue'), meta: { title: 'Lịch đặt phòng', icon: 'calendar', group: 'Homestay', perm: 'rooms.view' } },
  { path: '/products', name: 'products', component: () => import('../views/ProductsView.vue'), meta: { title: 'Hàng hoá & kho', icon: 'box', group: 'Quản lý', perm: 'products.view' } },
  { path: '/customers', name: 'customers', component: () => import('../views/CustomersView.vue'), meta: { title: 'Khách hàng', icon: 'users', group: 'Quản lý', perm: 'customers.view' } },
  { path: '/reports', name: 'reports', component: () => import('../views/ReportsView.vue'), meta: { title: 'Báo cáo', icon: 'chart', group: 'Quản lý', perm: 'reports.view' } },
  { path: '/shifts', name: 'shifts', component: () => import('../views/ShiftsView.vue'), meta: { title: 'Ca làm việc', icon: 'fa-cash-register', group: 'Vận hành', perm: 'shifts.open' } },
  { path: '/audit', name: 'audit', component: () => import('../views/AuditView.vue'), meta: { title: 'Nhật ký thao tác', icon: 'fa-clock-rotate-left', group: 'Vận hành', perm: 'audit.view' } },
  { path: '/settings', name: 'settings', component: () => import('../views/SettingsView.vue'), meta: { title: 'Cài đặt', icon: 'settings', group: 'Vận hành' } },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }), // chuyển trang luôn về đầu
})

/** Trang đầu tiên người dùng hiện tại được phép vào (VD: Buồng phòng -> Sơ đồ phòng) */
export function firstAllowedPath() {
  const auth = useAuth()
  const r = routes.find((r) => !r.meta?.public && !r.redirect && (!r.meta?.perm || auth.can(r.meta.perm)))
  return r?.path || '/settings'
}

// Chặn trang khi chưa đăng nhập / đang khoá / không có quyền
router.beforeEach((to) => {
  if (to.meta.public) return true
  const auth = useAuth()
  if (!auth.isAuthenticated) return { path: '/login', query: to.fullPath !== '/' ? { redirect: to.fullPath } : {} }
  if (to.meta.perm && !auth.can(to.meta.perm)) return firstAllowedPath() === to.path ? true : firstAllowedPath()
  return true
})
router.afterEach((to) => (document.title = `${to.meta.title} · Dreamers Home & Coffee`))
export default router
