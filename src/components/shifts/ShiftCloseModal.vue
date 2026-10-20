<script setup>
/** Đóng ca: đếm tiền theo mệnh giá, so với tiền dự kiến, in phiếu chốt ca */
import { ref, computed } from 'vue'
import BaseModal from '../ui/BaseModal.vue'
import Icon from '../ui/Icon.vue'
import ShiftPrintModal from './ShiftPrintModal.vue'
import { useShifts, DENOMINATIONS } from '../../stores/shifts'
import { useUi } from '../../stores/ui'
import { money, number, fmtDateTime } from '../../utils/format'

const emit = defineEmits(['close', 'closed'])
const shifts = useShifts()
const ui = useUi()
const s = shifts.current
const sum = computed(() => shifts.summary(s))

const counts = ref(Object.fromEntries(DENOMINATIONS.map((d) => [d, 0])))
const useCounter = ref(true)
const manual = ref(null)
const counted = computed(() =>
  useCounter.value ? DENOMINATIONS.reduce((t, d) => t + d * (+counts.value[d] || 0), 0) : +manual.value || 0
)
const diff = computed(() => counted.value - sum.value.expectedCash)
const note = ref('')
const done = ref(null) // ca vừa đóng -> chuyển sang màn hình in

async function submit() {
  if (diff.value !== 0 && !note.value.trim())
    return ui.toast('Két đang lệch — ghi chú lý do trước khi đóng ca', 'error')
  if (!(await ui.confirm(`Đóng ca ${s.code}? Sau khi đóng, hoá đơn mới sẽ cần mở ca khác.`, { okText: 'Đóng ca' }))) return
  shifts.close({ countedCash: counted.value, counts: useCounter.value ? { ...counts.value } : null, note: note.value })
  ui.toast(`Đã đóng ca ${s.code}`)
  emit('closed', s)
  done.value = s // ở lại để in phiếu chốt ca / tổng kết ngày
}
</script>

<template>
  <ShiftPrintModal v-if="done" :shift="done" tab="day" @close="emit('close')">
    <div class="closed-ok">
      <Icon name="fa-circle-check" :size="20" />
      <div><b>Đã đóng ca {{ done.code }}</b><span>In phiếu chốt ca hoặc tổng kết cả ngày hôm nay.</span></div>
    </div>
  </ShiftPrintModal>
  <BaseModal v-else :title="`Đóng ca ${s.code}`" width="720px" @close="emit('close')">
    <div class="close-grid">
      <!-- Tóm tắt ca -->
      <section>
        <h4 class="sec">Doanh thu trong ca</h4>
        <dl class="kv-list">
          <dt>Người mở ca</dt><dd>{{ s.userName }} · {{ fmtDateTime(s.openedAt) }}</dd>
          <dt>Số hoá đơn</dt><dd class="num">{{ sum.count }}<span v-if="sum.cancelled" class="muted"> (+{{ sum.cancelled }} huỷ)</span></dd>
          <dt>Tiền mặt</dt><dd class="num">{{ money(sum.cash) }}</dd>
          <dt>Chuyển khoản</dt><dd class="num">{{ money(sum.transfer) }}</dd>
          <dt>Thẻ</dt><dd class="num">{{ money(sum.card) }}</dd>
          <dt class="strong">Tổng doanh thu</dt><dd class="num strong">{{ money(sum.revenue) }}</dd>
        </dl>
        <div class="expect">
          <div><span class="muted">Tiền đầu ca</span><b class="num">{{ money(s.openingCash) }}</b></div>
          <div><span class="muted">+ Tiền mặt bán được</span><b class="num">{{ money(sum.cash) }}</b></div>
          <div class="total"><span>Tiền trong két dự kiến</span><b class="num">{{ money(sum.expectedCash) }}</b></div>
        </div>
      </section>

      <!-- Đếm két -->
      <section>
        <div class="flex" style="justify-content: space-between">
          <h4 class="sec">Đếm tiền thực tế</h4>
          <div class="segmented">
            <button :class="{ active: useCounter }" @click="useCounter = true">Theo tờ</button>
            <button :class="{ active: !useCounter }" @click="useCounter = false">Nhập tổng</button>
          </div>
        </div>
        <div v-if="useCounter" class="denoms">
          <div v-for="d in DENOMINATIONS" :key="d" class="denom">
            <span class="denom__face num">{{ number(d) }}</span>
            <span class="muted">×</span>
            <input class="input num" type="number" min="0" v-model.number="counts[d]" />
            <span class="denom__sum num">{{ number(d * (+counts[d] || 0)) }}</span>
          </div>
        </div>
        <input v-else class="input input--money num" type="number" min="0" step="1000" v-model="manual" placeholder="Tổng tiền đếm được" />

        <div class="result" :class="diff === 0 ? 'ok' : diff > 0 ? 'over' : 'short'">
          <div><span>Đếm được</span><b class="num">{{ money(counted) }}</b></div>
          <div><span>{{ diff === 0 ? 'Khớp két' : diff > 0 ? 'Thừa' : 'Thiếu' }}</span><b class="num">{{ diff > 0 ? '+' : '' }}{{ money(diff) }}</b></div>
        </div>
        <div class="field mt-16">
          <label>Ghi chú {{ diff !== 0 ? '(bắt buộc khi lệch két)' : '' }}</label>
          <input class="input" v-model="note" placeholder="VD: thối nhầm tiền lẻ" />
        </div>
      </section>
    </div>
    <template #footer>
      <button class="btn btn--ghost" @click="emit('close')">Huỷ</button>
      <button class="btn btn--primary" @click="submit"><Icon name="fa-lock" :size="15" />Chốt & đóng ca</button>
    </template>
  </BaseModal>
</template>

<style lang="scss">
@use '../../styles/tokens' as *;
.close-grid { display: grid; grid-template-columns: 1fr 1.1fr; gap: 24px; @include mobile { grid-template-columns: 1fr; } }
.sec { font-size: 13px; color: $text-muted; font-weight: 600; margin: 0 0 10px; }
.kv-list {
  display: grid; grid-template-columns: auto 1fr; gap: 8px 12px; margin: 0;
  dt { color: $text-2; } dd { margin: 0; text-align: right; font-weight: 500; }
  .strong { font-weight: 700; color: $text; }
}
.expect {
  margin-top: 16px; padding: 12px 14px; border-radius: 14px; background: $surface-2; display: flex; flex-direction: column; gap: 6px;
  div { display: flex; justify-content: space-between; }
  .total { padding-top: 8px; border-top: 1px solid $border; font-weight: 600; b { font-size: 17px; } }
}
.closed-ok {
  display: flex; gap: 12px; align-items: center; padding: 12px 14px; margin-bottom: 14px; border-radius: 14px; background: $success-soft; color: $success;
  div { display: flex; flex-direction: column; } span { font-size: 12px; color: $text-2; }
}
.denoms { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 14px; }
.denom {
  display: grid; grid-template-columns: 62px 10px 1fr; align-items: center; gap: 6px; font-size: 13px;
  &__face { font-weight: 600; text-align: right; }
  &__sum { grid-column: 3; text-align: right; color: $text-muted; font-size: 11px; margin-top: -4px; }
  .input { height: 34px; text-align: center; }
}
.result {
  margin-top: 14px; padding: 12px 14px; border-radius: 14px; display: flex; flex-direction: column; gap: 4px;
  div { display: flex; justify-content: space-between; } b { font-size: 16px; }
  &.ok { background: $success-soft; color: $success; }
  &.over { background: $info-soft; color: $info; }
  &.short { background: $danger-soft; color: $danger; }
}
</style>
