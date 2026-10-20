<script setup>
/** Thẻ QR chuyển khoản: khách quét bằng app ngân hàng, số tiền + nội dung tự điền sẵn */
import { ref, computed, watchEffect } from 'vue'
import Icon from '../ui/Icon.vue'
import { useSettings } from '../../stores/settings'
import { vietQrImage, bankByBin, plainText } from '../../utils/vietqr'
import { money } from '../../utils/format'

const props = defineProps({
  amount: { type: Number, default: 0 },
  note: { type: String, default: '' },
  size: { type: Number, default: 200 },
  compact: Boolean, // bản nhỏ để in trên hoá đơn
})
const settings = useSettings()
const pay = computed(() => settings.payment)
const ready = computed(() => !!(pay.value.bin && pay.value.account))
const bank = computed(() => bankByBin(pay.value.bin))
const src = ref('')
watchEffect(async () => {
  if (!ready.value) return (src.value = '')
  src.value = await vietQrImage({ bin: pay.value.bin, account: pay.value.account, amount: props.amount, note: props.note }, props.size)
})
</script>

<template>
  <div v-if="ready" class="vqr" :class="{ 'vqr--compact': compact }">
    <img v-if="src" :src="src" :width="compact ? 150 : size" :height="compact ? 150 : size" alt="Mã VietQR chuyển khoản" class="vqr__img" />
    <div class="vqr__info">
      <div class="vqr__bank">{{ bank?.name || 'Ngân hàng' }} · <b class="num">{{ pay.account }}</b></div>
      <div v-if="pay.holder" class="vqr__holder">{{ pay.holder.toUpperCase() }}</div>
      <div v-if="amount && !compact" class="vqr__amount num">{{ money(amount) }}</div>
      <div v-if="note" class="vqr__note">Nội dung: {{ plainText(note) }}</div>
    </div>
  </div>
  <RouterLink v-else-if="!compact" to="/settings?tab=payment" class="vqr-empty">
    <Icon name="fa-qrcode" :size="18" /><span>Chưa cài tài khoản nhận chuyển khoản — bấm để cài đặt mã VietQR</span>
  </RouterLink>
</template>

<style lang="scss">
@use '../../styles/tokens' as *;
.vqr {
  display: flex; align-items: center; gap: 14px; padding: 12px; border-radius: 14px; background: $surface-2; border: 1px solid $border;
  &__img { flex: none; border-radius: 10px; background: #fff; padding: 4px; }
  &__info { min-width: 0; display: flex; flex-direction: column; gap: 3px; font-size: 13px; color: $text-2; }
  &__bank b { color: $text; }
  &__holder { font-weight: 600; color: $text; letter-spacing: .02em; }
  &__amount { font: 700 20px/1.2 $font-display; color: $text; margin-top: 4px; }
  &__note { font-size: 12px; color: $text-muted; }
  &--compact { flex-direction: column; background: none; border: 0; padding: 6px 0 0; gap: 4px; text-align: center;
    .vqr__info { align-items: center; font-size: 11px; color: #000; } .vqr__holder, .vqr__bank b { color: #000; } .vqr__note { color: #333; } }
}
.vqr-empty { display: flex; align-items: center; gap: 10px; padding: 12px; border-radius: 12px; border: 1px dashed $border-strong; color: $text-2; font-size: 13px; text-decoration: none;
  &:hover { background: $fill; } }
</style>
