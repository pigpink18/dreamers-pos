import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useAuth } from './auth'
import { useSettings } from './settings'
import { useShifts } from './shifts'

/** Toast + hộp thoại xác nhận dùng chung cho toàn app */
export const useUi = defineStore('ui', () => {
  const toasts = ref([])
  const confirmState = ref(null)

  function toast(message, type = 'success') {
    const id = Math.random()
    toasts.value.push({ id, message, type })
    setTimeout(() => (toasts.value = toasts.value.filter((t) => t.id !== id)), 3000)
  }

  /** await ui.confirm('Xoá?') -> true/false */
  function confirm(message, { title = 'Xác nhận', okText = 'Đồng ý', danger = false } = {}) {
    return new Promise((resolve) => {
      confirmState.value = { message, title, okText, danger, resolve }
    })
  }
  function closeConfirm(result) {
    confirmState.value?.resolve(result)
    confirmState.value = null
  }

  /**
   * QUẢN LÝ DUYỆT: thao tác nhạy cảm cần người có quyền nhập PIN.
   *   const approver = await ui.approve({ perm: 'invoices.cancel', reason: 'Huỷ HD000123' })
   *   if (!approver) return   // bị từ chối / huỷ
   * - Nếu người đang đăng nhập đã có quyền -> duyệt luôn, không hỏi PIN.
   * - check(user): điều kiện thêm (vd: mức giảm giá tối đa của vai trò)
   */
  const approvalState = ref(null)
  function approve({ perm, reason, check }) {
    const auth = useAuth()
    const ok = (u) => (!perm || auth.userCan(u, perm)) && (!check || check(u))
    if (auth.user && ok(auth.user)) return Promise.resolve(auth.user)
    // bỏ con trỏ khỏi ô đang nhập: PIN gõ bằng bàn phím không được lọt vào ô giảm giá / số tiền
    document.activeElement?.blur?.()
    return new Promise((resolve) => {
      approvalState.value = { perm, reason, ok, resolve }
    })
  }
  function closeApproval(user) {
    approvalState.value?.resolve(user || null)
    approvalState.value = null
  }

  /**
   * BẮT BUỘC CÓ CA trước khi thu tiền (nếu bật trong Cài đặt › Vận hành).
   *   if (!(await ui.requireShift())) return
   * Chưa có ca -> mở cửa sổ "Mở ca"; mở xong thì tiếp tục luôn.
   */
  const shiftRequest = ref(null)
  function requireShift() {
    if (!useSettings().ops.requireShift || useShifts().current) return Promise.resolve(true)
    if (!useAuth().can('shifts.open')) {
      toast('Chưa mở ca — nhờ quản lý hoặc thu ngân mở ca trước khi thu tiền', 'error')
      return Promise.resolve(false)
    }
    return new Promise((resolve) => (shiftRequest.value = { resolve }))
  }
  function resolveShift(ok) {
    shiftRequest.value?.resolve(ok)
    shiftRequest.value = null
  }

  return { toasts, toast, confirmState, confirm, closeConfirm, approvalState, approve, closeApproval, shiftRequest, requireShift, resolveShift }
})
