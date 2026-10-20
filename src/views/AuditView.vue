<script setup>
/** NHẬT KÝ THAO TÁC — ai làm gì, lúc nào, ai duyệt */
import { ref, computed, watch } from 'vue'
import Icon from '../components/ui/Icon.vue'
import AppDate from '../components/ui/AppDate.vue'
import AppSelect from '../components/ui/AppSelect.vue'
import { useAudit, ACTIONS } from '../stores/audit'
import { useAuth, initials } from '../stores/auth'
import { fmtTime, fmtDate, dateKey, addDays, normalize, toCsv, download, fmtDateTime } from '../utils/format'

const audit = useAudit()
const auth = useAuth()
const today = dateKey()

const from = ref(addDays(today, -6))
const to = ref(today)
const who = ref('')
const kind = ref('')
const q = ref('')

// Nhóm hành động cho bộ lọc
const KINDS = {
  sensitive: ['Thao tác nhạy cảm', ['invoice.cancel', 'invoice.discount', 'product.price', 'booking.cancel', 'login.fail', 'user.disable', 'role.update', 'data.reset', 'data.restore']],
  shift: ['Ca làm việc', ['shift.open', 'shift.close']],
  login: ['Đăng nhập / khoá', ['login', 'login.switch', 'login.fail', 'lock', 'logout']],
  sale: ['Bán hàng', ['invoice.create', 'invoice.cancel', 'invoice.discount']],
  room: ['Phòng', ['booking.create', 'booking.update', 'booking.cancel', 'room.checkin', 'room.checkout', 'room.clean', 'room.update']],
  stock: ['Hàng hoá & kho', ['product.create', 'product.update', 'product.price', 'product.disable', 'stock.import']],
  admin: ['Quản trị', ['user.create', 'user.update', 'user.disable', 'user.enable', 'role.update', 'role.delete', 'settings.update', 'data.reset', 'data.restore']],
}
const SENSITIVE = new Set(KINDS.sensitive[1])

const filtered = computed(() => {
  const k = normalize(q.value)
  const set = kind.value ? new Set(KINDS[kind.value][1]) : null
  return audit.entries.filter((e) => {
    const d = dateKey(e.at)
    return d >= from.value && d <= to.value && (!who.value || e.userId === who.value) && (!set || set.has(e.action)) &&
      (!k || normalize(e.detail).includes(k) || normalize(e.userName).includes(k))
  })
})
const PAGE = 50
const shown = ref(PAGE)
watch([from, to, who, kind, q], () => (shown.value = PAGE))

// Gom theo ngày như "Hôm nay / Hôm qua"
const byDay = computed(() => {
  const g = []
  filtered.value.slice(0, shown.value).forEach((e) => {
    const d = dateKey(e.at)
    let last = g[g.length - 1]
    if (!last || last.day !== d) g.push((last = { day: d, items: [] }))
    last.items.push(e)
  })
  return g
})
const dayLabel = (d) => (d === today ? 'Hôm nay' : d === addDays(today, -1) ? 'Hôm qua' : fmtDate(d))
const color = (e) => auth.roleById(auth.userById(e.userId)?.roleId)?.color || '#8e8e93'

function exportCsv() {
  const rows = [['Thời gian', 'Người thực hiện', 'Thao tác', 'Chi tiết', 'Người duyệt']]
  filtered.value.forEach((e) => rows.push([fmtDateTime(e.at), e.userName, ACTIONS[e.action]?.[0] || e.action, e.detail, e.approvedBy || '']))
  download(`nhat-ky_${from.value}_${to.value}.csv`, toCsv(rows))
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div><h1>Nhật ký thao tác</h1><p>{{ filtered.length }} hoạt động · mọi thao tác quan trọng đều được ghi lại</p></div>
      <div class="spacer"></div>
      <button class="btn btn--ghost" @click="exportCsv"><Icon name="download" :size="15" />Xuất CSV</button>
    </div>

    <div class="card">
      <div class="toolbar">
        <div class="flex date-range">
          <AppDate v-model="from" /><span class="muted">→</span><AppDate v-model="to" :min="from" />
        </div>
        <AppSelect v-model="who" :options="[{ value: '', label: 'Mọi người' }, ...auth.users.map((u) => ({ value: u.id, label: u.name, sub: auth.roleById(u.roleId)?.name }))]" style="width: 180px" />
        <AppSelect v-model="kind" :options="[{ value: '', label: 'Mọi thao tác' }, ...Object.entries(KINDS).map(([value, [label]]) => ({ value, label }))]" style="width: 200px" />
        <div class="search" style="flex: 1; min-width: 180px"><input class="input" v-model="q" placeholder="Tìm mã hoá đơn, tên…" /></div>
      </div>

      <div class="timeline">
        <template v-for="g in byDay" :key="g.day">
          <div class="timeline__day">{{ dayLabel(g.day) }}</div>
          <div v-for="e in g.items" :key="e.id" class="tl-item" :class="{ sensitive: SENSITIVE.has(e.action) }">
            <span class="tl-item__time num">{{ fmtTime(e.at) }}</span>
            <span class="tl-item__icon"><Icon :name="ACTIONS[e.action]?.[1] || 'info'" :size="15" /></span>
            <div class="tl-item__body">
              <div>
                <b>{{ ACTIONS[e.action]?.[0] || e.action }}</b>
                <span class="muted"> · {{ e.detail }}</span>
              </div>
              <div class="tl-item__who">
                <span class="avatar avatar--xs" :style="{ background: color(e) }">{{ initials(e.userName) }}</span>{{ e.userName }}
                <span v-if="e.approvedBy" class="badge badge--info badge--plain"><Icon name="fa-user-shield" :size="11" /> {{ e.approvedBy }} duyệt</span>
              </div>
            </div>
          </div>
        </template>
        <div v-if="!filtered.length" class="empty">Không có hoạt động nào</div>
        <div v-if="filtered.length > shown" style="text-align: center; padding: 12px">
          <button class="btn btn--ghost btn--sm" @click="shown += PAGE">Xem thêm ({{ filtered.length - shown }})</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
@use '../styles/tokens' as *;
.timeline { padding: 6px 20px 16px; }
.timeline__day { position: sticky; top: $topbar-h; z-index: 1; padding: 14px 0 6px; font-size: 12px; font-weight: 600; color: $text-muted; background: $surface; }
.tl-item {
  display: grid; grid-template-columns: 46px 30px 1fr; gap: 10px; align-items: start; padding: 10px 0; border-bottom: 1px solid $border;
  &__time { font-size: 12px; color: $text-muted; padding-top: 6px; }
  &__icon { width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center; background: $fill; color: $text-2; }
  &__body { min-width: 0; line-height: 1.45; }
  &__who { display: flex; align-items: center; gap: 6px; margin-top: 3px; font-size: 12px; color: $text-2; flex-wrap: wrap; }
  &.sensitive .tl-item__icon { background: $warning-soft; color: $warning; }
}
.avatar--xs { width: 18px; height: 18px; font-size: 8px; }
.date-range { .app-date { width: 150px; } }
@include mobile { .date-range { flex: 1 1 100% !important; .app-date { flex: 1; width: auto; min-width: 0; } } .timeline { padding: 4px 14px 12px; } }
</style>
