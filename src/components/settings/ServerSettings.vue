<script setup>
/** Kết nối máy chủ Supabase để mọi máy dùng chung dữ liệu */
import { reactive, ref, computed } from 'vue'
import Icon from '../ui/Icon.vue'
import BaseModal from '../ui/BaseModal.vue'
import { sync } from '../../sync/engine'
import { connect, startSync, disconnect, getConfig } from '../../sync/connection'
import { useUi } from '../../stores/ui'
import { useAudit } from '../../stores/audit'
import { fmtDateTime } from '../../utils/format'

const ui = useUi()
const cfg = getConfig() || {}
const f = reactive({ url: cfg.url || '', key: cfg.key || '', email: cfg.email || '', password: '' })
const busy = ref(false)
const choice = ref(null) // { remote } khi cần hỏi lấy dữ liệu bên nào
const st = sync.status
const connected = computed(() => st.state === 'online' || st.state === 'offline' || st.state === 'connecting')

const STATE = {
  off: ['Chưa kết nối', 'muted', 'fa-plug'],
  connecting: ['Đang kết nối…', 'info', 'fa-cloud-arrow-up'],
  online: ['Đang đồng bộ', 'success', 'fa-cloud'],
  offline: ['Mất kết nối — dữ liệu vẫn lưu trên máy, sẽ tự gửi khi có mạng', 'warning', 'fa-cloud-slash'],
}

async function doConnect() {
  if (!f.url || !f.key || !f.email || !f.password) return ui.toast('Điền đủ URL, khoá, email và mật khẩu', 'error')
  busy.value = true
  try {
    const r = await connect(f)
    f.password = ''
    if (r.needChoice) choice.value = { remote: r.remote }
    else await begin(r.remote ? 'resume' : 'push')
  } catch (e) {
    ui.toast(e.message || 'Không kết nối được máy chủ', 'error')
  } finally { busy.value = false }
}

async function begin(mode) {
  busy.value = true
  try {
    if (mode === 'push' && choice.value && !(await ui.confirm('Ghi dữ liệu máy này lên máy chủ? Dữ liệu trùng mã trên máy chủ sẽ bị thay bằng bản của máy này.', { danger: true, okText: 'Ghi lên máy chủ' }))) return
    await startSync(mode)
    choice.value = null
    useAudit().log('settings.update', mode === 'pull' ? 'Kết nối máy chủ · lấy dữ liệu máy chủ' : mode === 'push' ? 'Kết nối máy chủ · đưa dữ liệu máy này lên' : 'Kết nối máy chủ')
    ui.toast(mode === 'pull' ? 'Đã tải dữ liệu từ máy chủ' : 'Đã kết nối — dữ liệu đang được đồng bộ')
  } catch (e) {
    ui.toast('Lỗi đồng bộ: ' + (e.message || e), 'error')
  } finally { busy.value = false }
}

async function doDisconnect() {
  if (!(await ui.confirm('Ngắt kết nối máy chủ trên máy này? Dữ liệu vẫn còn trên máy và trên máy chủ.', { okText: 'Ngắt kết nối' }))) return
  await disconnect()
  ui.toast('Đã ngắt kết nối máy chủ')
}
async function syncNow() {
  await sync.flush(); await sync.pull()
  ui.toast(st.state === 'online' ? 'Đã đồng bộ' : 'Chưa kết nối được máy chủ', st.state === 'online' ? 'success' : 'error')
}
</script>

<template>
  <section class="card">
    <div class="card__header"><h3>Máy chủ & đồng bộ</h3></div>
    <div class="card__body">
      <div class="srv-status" :class="`is-${STATE[st.state][1]}`">
        <Icon :name="STATE[st.state][2]" :size="20" />
        <div>
          <b>{{ STATE[st.state][0] }}</b>
          <small v-if="st.state !== 'off'">
            {{ st.pending ? `${st.pending} thay đổi chờ gửi · ` : '' }}{{ st.lastSync ? 'Đồng bộ lần cuối ' + fmtDateTime(st.lastSync) : '' }}
          </small>
          <small v-if="st.error" class="srv-status__err">{{ st.error }}</small>
        </div>
        <div class="spacer"></div>
        <template v-if="st.state !== 'off'">
          <button class="btn btn--ghost btn--sm" @click="syncNow"><Icon name="fa-arrows-rotate" :size="14" />Đồng bộ ngay</button>
          <button class="btn btn--ghost btn--sm" @click="doDisconnect">Ngắt kết nối</button>
        </template>
      </div>

      <p class="muted" style="margin: 16px 0">
        Kết nối Supabase để <b>mọi máy (máy quầy, điện thoại, máy tính bảng) dùng chung dữ liệu</b> theo thời gian thực.
        Mất mạng vẫn bán được bình thường — có mạng lại sẽ tự gửi lên. Xem hướng dẫn tạo máy chủ trong file <code>supabase/HUONG-DAN.md</code>.
      </p>

      <form v-if="!connected" class="form-grid" @submit.prevent="doConnect">
        <div class="field full"><label>URL dự án (Project URL)</label><input class="input" v-model="f.url" placeholder="https://xxxxxxxx.supabase.co" autocomplete="off" /></div>
        <div class="field full"><label>Khoá công khai (anon / publishable key)</label><input class="input" v-model="f.key" placeholder="eyJhbGciOi… hoặc sb_publishable_…" autocomplete="off" /></div>
        <div class="field"><label>Email tài khoản cửa hàng</label><input class="input" v-model="f.email" type="email" autocomplete="username" /></div>
        <div class="field"><label>Mật khẩu</label><input class="input" v-model="f.password" type="password" autocomplete="current-password" /></div>
        <div class="full"><button class="btn btn--primary" :disabled="busy"><Icon name="fa-cloud" :size="15" />{{ busy ? 'Đang kết nối…' : 'Kết nối' }}</button></div>
      </form>
      <div v-else class="srv-info">
        <div><span class="muted">Máy chủ</span><b>{{ f.url }}</b></div>
        <div><span class="muted">Tài khoản</span><b>{{ f.email }}</b></div>
        <div><span class="muted">Mã máy này</span><b class="num">{{ st.device }}</b></div>
      </div>
    </div>

    <!-- Lần đầu kết nối mà máy chủ đã có dữ liệu -->
    <BaseModal v-if="choice" title="Máy chủ đã có dữ liệu" width="520px" @close="choice = null">
      <p style="margin-top: 0">Máy chủ đang có <b class="num">{{ choice.remote.toLocaleString('vi-VN') }}</b> bản ghi (có thể từ máy quầy). Bạn muốn dùng dữ liệu nào cho máy này?</p>
      <div class="srv-choice">
        <button class="srv-choice__opt rec" :disabled="busy" @click="begin('pull')">
          <Icon name="fa-cloud-arrow-down" :size="22" />
          <b>Dùng dữ liệu máy chủ</b>
          <small>Khuyên dùng cho máy thứ 2, 3… Dữ liệu hiện có trên máy này (VD dữ liệu mẫu) sẽ được thay thế.</small>
        </button>
        <button class="srv-choice__opt" :disabled="busy" @click="begin('push')">
          <Icon name="fa-cloud-arrow-up" :size="22" />
          <b>Ghi dữ liệu máy này lên</b>
          <small>Chỉ chọn nếu máy này mới là dữ liệu đúng.</small>
        </button>
      </div>
    </BaseModal>
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
  div { display: flex; gap: 12px; } span { width: 110px; flex: none; } b { word-break: break-all; font-weight: 500; } }
.srv-choice { display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
  &__opt { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; padding: 16px; border-radius: 14px; border: 1px solid $border-strong;
    background: $surface; font: inherit; color: $text; text-align: left; cursor: pointer;
    small { color: $text-2; font-size: 12px; line-height: 1.4; } .icon { color: $text-2; }
    &:hover { border-color: $primary; } &.rec { border-color: $primary; background: $primary-soft; .icon { color: $primary; } } }
  @include mobile { grid-template-columns: 1fr; }
}
</style>
