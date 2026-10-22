<script setup>
/** Tài khoản chủ quán & đồng bộ (hệ thống nhiều quán) */
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import Icon from '../ui/Icon.vue'
import { sync } from '../../sync/engine'
import { useUi } from '../../stores/ui'
import { fmtDateTime } from '../../utils/format'
import { isLegacy, activeShop, platformConfigured } from '../../tenant'

const ui = useUi()
const router = useRouter()
const st = sync.status
const email = ref('')
const configured = platformConfigured()

const STATE = {
  off: ['Chưa đồng bộ', 'muted', 'fa-plug'],
  connecting: ['Đang kết nối…', 'info', 'fa-cloud-arrow-up'],
  online: ['Đang đồng bộ', 'success', 'fa-cloud'],
  offline: ['Mất kết nối — dữ liệu vẫn lưu trên máy, sẽ tự gửi khi có mạng', 'warning', 'fa-cloud-slash'],
}

onMounted(async () => {
  if (!configured || isLegacy) return
  const m = await import('../../sync/connection')
  email.value = (await m.getSession())?.user?.email || ''
})

async function syncNow() {
  if (st.state === 'off' || st.state === 'offline') {
    const m = await import('../../sync/connection')
    await m.startSync('resume').catch(() => {})
  } else { await sync.flush(); await sync.pull() }
  ui.toast(st.state === 'online' ? 'Đã đồng bộ' : 'Chưa kết nối được máy chủ', st.state === 'online' ? 'success' : 'error')
}
</script>

<template>
  <section class="card">
    <div class="card__header"><h3>Tài khoản & đồng bộ</h3></div>
    <div class="card__body">
      <!-- Đang mở 1 quán trên hệ thống -->
      <template v-if="!isLegacy">
        <div class="srv-status" :class="`is-${STATE[st.state][1]}`">
          <Icon :name="STATE[st.state][2]" :size="20" />
          <div>
            <b>{{ STATE[st.state][0] }}</b>
            <small>{{ st.pending ? `${st.pending} thay đổi chờ gửi · ` : '' }}{{ st.lastSync ? 'Đồng bộ lần cuối ' + fmtDateTime(st.lastSync) : '' }}</small>
            <small v-if="st.error" class="srv-status__err">{{ st.error }}</small>
          </div>
          <div class="spacer"></div>
          <button class="btn btn--ghost btn--sm" @click="syncNow"><Icon name="fa-arrows-rotate" :size="14" />Đồng bộ ngay</button>
        </div>
        <div class="srv-info mt-16">
          <div><span class="muted">Quán</span><b>{{ activeShop?.name }}</b></div>
          <div><span class="muted">Tài khoản chủ quán</span><b>{{ email || '—' }}</b></div>
          <div><span class="muted">Mã máy này</span><b class="num">{{ st.device }}</b></div>
        </div>
        <p class="muted" style="margin: 16px 0">
          Mọi máy đăng nhập cùng tài khoản và mở quán này đều dùng chung dữ liệu theo thời gian thực. Dữ liệu của quán khác hoàn toàn tách biệt.
          Mất mạng vẫn bán được bình thường — có mạng lại sẽ tự gửi lên.
        </p>
        <button class="btn btn--ghost" @click="router.push('/account')"><Icon name="fa-store" :size="15" />Tài khoản & đổi quán</button>
      </template>

      <!-- Chế độ 1 máy -->
      <template v-else>
        <div class="srv-status is-muted"><Icon name="fa-plug" :size="20" /><div><b>Đang dùng trên 1 máy</b><small>Dữ liệu chỉ nằm trên máy này</small></div></div>
        <p class="muted" style="margin: 16px 0">
          Đăng ký tài khoản chủ quán để dùng chung dữ liệu trên nhiều máy (máy quầy, điện thoại, máy tính bảng) và quản lý nhiều quán.
          Dữ liệu đang có trên máy này có thể đưa lên thành 1 quán khi tạo quán.
          {{ configured ? '' : 'Bản app này chưa cài máy chủ — xem hướng dẫn trong supabase/HUONG-DAN.md.' }}
        </p>
        <button class="btn btn--primary" @click="router.push('/account')"><Icon name="fa-user" :size="15" />{{ configured ? 'Đăng nhập / đăng ký chủ quán' : 'Cài máy chủ' }}</button>
      </template>
    </div>
  </section>
</template>

<style lang="scss">
@use '../../styles/tokens' as *;
.srv-status {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 14px 16px; border-radius: 14px; background: $fill;
  > div:nth-child(2) { display: flex; flex-direction: column; gap: 2px; small { font-size: 12px; color: $text-2; } }
  &__err { color: $danger !important; }
  &.is-success { background: $success-soft; > .icon { color: $success; } }
  &.is-warning { background: $warning-soft; > .icon { color: $warning; } }
  &.is-info { background: $info-soft; > .icon { color: $info; } }
}
.srv-info { display: flex; flex-direction: column; gap: 8px; font-size: 13px;
  div { display: flex; gap: 12px; } span { width: 140px; flex: none; } b { word-break: break-all; font-weight: 500; } }
</style>
