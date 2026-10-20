<script setup>
/** CA LÀM VIỆC: ca đang mở, lịch sử ca, đối soát két, in phiếu chốt ca */
import { ref, computed } from 'vue'
import Icon from '../components/ui/Icon.vue'
import BaseModal from '../components/ui/BaseModal.vue'
import StatCard from '../components/ui/StatCard.vue'
import ShiftOpenModal from '../components/shifts/ShiftOpenModal.vue'
import ShiftCloseModal from '../components/shifts/ShiftCloseModal.vue'
import ShiftPrintModal from '../components/shifts/ShiftPrintModal.vue'
import { useShifts, DENOMINATIONS } from '../stores/shifts'
import { useAuth } from '../stores/auth'
import { useSettings } from '../stores/settings'
import { money, number, fmtDateTime, fmtTime, fmtDate, dateKey } from '../utils/format'

const shifts = useShifts()
const auth = useAuth()
const settings = useSettings()

const showOpen = ref(false)
const showClose = ref(false)
const detail = ref(null)
const dayPrint = ref(null) // 'YYYY-MM-DD' -> in tổng kết ngày

const cur = computed(() => shifts.current)
const curSum = computed(() => (cur.value ? shifts.summary(cur.value) : null))

// Người không có quyền "xem ca của mọi người" chỉ thấy ca mình mở
const list = computed(() =>
  shifts.items.filter((s) => auth.can('shifts.viewAll') || s.userId === auth.user?.id || s.closedById === auth.user?.id)
)
const closed = computed(() => list.value.filter((s) => s.status === 'closed'))
const last7 = computed(() => closed.value.filter((s) => dateKey(s.openedAt) >= dateKey(new Date(Date.now() - 6 * 864e5))))
const totalDiff = computed(() => last7.value.reduce((t, s) => t + (s.diff || 0), 0))
const mismatches = computed(() => last7.value.filter((s) => s.diff).length)

const duration = (s) => {
  const ms = new Date(s.closedAt || Date.now()) - new Date(s.openedAt)
  const h = Math.floor(ms / 36e5), m = Math.round((ms % 36e5) / 6e4)
  return `${h}g${String(m).padStart(2, '0')}`
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div><h1>Ca làm việc</h1><p>Mở ca, chốt két và đối soát tiền mặt cuối ca</p></div>
      <div class="spacer"></div>
      <button class="btn btn--ghost" @click="dayPrint = dateKey()"><Icon name="print" :size="15" />Tổng kết hôm nay</button>
      <button v-if="!cur" class="btn btn--primary" @click="showOpen = true"><Icon name="fa-lock-open" :size="15" />Mở ca</button>
      <button v-else class="btn btn--primary" @click="showClose = true"><Icon name="fa-lock" :size="15" />Đóng ca {{ cur.code }}</button>
    </div>

    <!-- Ca đang mở -->
    <div v-if="cur" class="card live">
      <div class="live__head">
        <span class="live__dot"></span>
        <div>
          <h3>Ca {{ cur.code }} đang mở</h3>
          <p class="muted">{{ cur.userName }} mở lúc {{ fmtTime(cur.openedAt) }} {{ fmtDate(cur.openedAt) }} · đã {{ duration(cur) }}</p>
        </div>
      </div>
      <div class="live__stats">
        <div><span>Hoá đơn</span><b class="num">{{ curSum.count }}</b></div>
        <div><span>Doanh thu</span><b class="num">{{ money(curSum.revenue) }}</b></div>
        <div><span>Tiền mặt</span><b class="num">{{ money(curSum.cash) }}</b></div>
        <div><span>Chuyển khoản / Thẻ</span><b class="num">{{ money(curSum.transfer + curSum.card) }}</b></div>
        <div class="hl"><span>Két dự kiến</span><b class="num">{{ money(curSum.expectedCash) }}</b></div>
      </div>
    </div>
    <div v-else class="card live live--closed">
      <Icon name="fa-cash-register" :size="28" />
      <div>
        <h3>Chưa mở ca</h3>
        <p class="muted">{{ settings.ops.requireShift ? 'Cần mở ca trước khi bán hàng hoặc thu tiền phòng.' : 'Có thể bán không cần ca, nhưng nên mở ca để đối soát két.' }}</p>
      </div>
    </div>

    <div class="grid-stats mt-16">
      <StatCard label="Ca đã chốt (7 ngày)" :value="number(last7.length)" icon="fa-clipboard-list" />
      <StatCard label="Ca bị lệch két" :value="number(mismatches)" icon="alert" :tone="mismatches ? 'warning' : 'success'" />
      <StatCard label="Tổng lệch 7 ngày" :value="money(totalDiff)" icon="fa-coins" :tone="totalDiff < 0 ? 'danger' : 'success'" />
    </div>

    <div class="card">
      <div class="card__header"><h3>Lịch sử ca</h3></div>
      <div class="table-wrap">
        <table class="table table--cards">
          <thead><tr><th>Ca</th><th>Người mở</th><th>Thời gian</th><th class="text-right">Hoá đơn</th><th class="text-right">Doanh thu</th><th class="text-right">Két dự kiến</th><th class="text-right">Đếm được</th><th class="text-right">Lệch</th></tr></thead>
          <tbody>
            <tr v-for="s in closed" :key="s.id" class="clickable" @click="detail = s">
              <td class="fw-600 c-title">{{ s.code }}</td>
              <td class="c-hide">{{ s.userName }}</td>
              <td class="num text-2 c-hide">{{ fmtDate(s.openedAt) }} · {{ fmtTime(s.openedAt) }}–{{ fmtTime(s.closedAt) }}</td>
              <td class="text-right num c-hide">{{ s.invoiceCount }}</td>
              <td class="text-right num c-hide">{{ money(s.revenue) }}</td>
              <td class="text-right num c-hide">{{ money(s.expectedCash) }}</td>
              <td class="text-right num c-hide">{{ money(s.countedCash) }}</td>
              <td class="text-right num c-end">
                <span class="badge badge--plain" :class="!s.diff ? 'badge--success' : s.diff > 0 ? 'badge--info' : 'badge--danger'">
                  {{ !s.diff ? 'Khớp' : (s.diff > 0 ? '+' : '') + number(s.diff) }}
                </span>
              </td>
              <td class="m-only c-sub">{{ s.userName }} · {{ fmtDate(s.openedAt) }} {{ fmtTime(s.openedAt) }}–{{ fmtTime(s.closedAt) }} · {{ money(s.revenue) }}</td>
            </tr>
            <tr v-if="!closed.length"><td colspan="8" class="empty">Chưa có ca nào được chốt</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Phiếu chốt ca / tổng kết ngày -->
    <ShiftPrintModal v-if="detail" :shift="detail" @close="detail = null" />
    <ShiftPrintModal v-if="dayPrint" :date="dayPrint" @close="dayPrint = null" />

    <ShiftOpenModal v-if="showOpen" @close="showOpen = false" />
    <ShiftCloseModal v-if="showClose" @close="showClose = false" />
  </div>
</template>

<style lang="scss">
@use '../styles/tokens' as *;
.live {
  padding: 20px 22px;
  &__head { display: flex; gap: 14px; align-items: center; h3 { font-size: 17px; } p { margin: 2px 0 0; } }
  &__dot { width: 12px; height: 12px; border-radius: 50%; background: $success; box-shadow: 0 0 0 5px $success-soft; flex-shrink: 0; }
  &__stats {
    display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-top: 18px;
    > div { padding: 12px 14px; border-radius: 14px; background: $surface-2; display: flex; flex-direction: column; gap: 2px; }
    span { font-size: 12px; color: $text-muted; } b { font-size: 18px; }
    .hl { background: $primary-soft; b { color: $primary; } }
    @include mobile { grid-template-columns: 1fr 1fr; }
  }
  &--closed { display: flex; align-items: center; gap: 16px; color: $warning; h3 { color: $text; font-size: 17px; } p { margin: 2px 0 0; } }
}
</style>
