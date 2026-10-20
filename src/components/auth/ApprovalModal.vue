<script setup>
/** Hộp "Cần quản lý duyệt": người có quyền nhập PIN để cho phép thao tác */
import { ref } from 'vue'
import PinPad from './PinPad.vue'
import Icon from '../ui/Icon.vue'
import { useUi } from '../../stores/ui'
import { useAuth, PERMISSION_LABEL } from '../../stores/auth'

const ui = useUi()
const auth = useAuth()
const pad = ref(null)
const error = ref('')

function onPin(pin) {
  const st = ui.approvalState
  const u = auth.findByPin(pin, st.ok)
  if (!u) {
    error.value = auth.findByPin(pin) ? 'Người này không có quyền duyệt thao tác này' : 'Mã PIN không đúng'
    pad.value?.shake()
    return
  }
  error.value = ''
  ui.toast(`${u.name} đã duyệt`)
  ui.closeApproval(u)
}
</script>

<template>
  <Teleport to="body">
    <div v-if="ui.approvalState" class="modal-backdrop modal-backdrop--top alert-backdrop" @mousedown.self="ui.closeApproval(null)">
      <div class="approval">
        <div class="approval__icon"><Icon name="fa-user-shield" :size="26" /></div>
        <h3>Cần quản lý duyệt</h3>
        <p class="approval__reason">{{ ui.approvalState.reason }}</p>
        <p v-if="ui.approvalState.perm" class="muted approval__perm">Quyền: {{ PERMISSION_LABEL[ui.approvalState.perm] }}</p>
        <PinPad ref="pad" @complete="onPin" />
        <p class="approval__error">{{ error }}</p>
        <button class="btn btn--plain" @click="ui.closeApproval(null)">Huỷ</button>
      </div>
    </div>
  </Teleport>
</template>

<style lang="scss">
@use '../../styles/tokens' as *;
.approval {
  width: 100%; max-width: 360px; padding: 26px 22px 14px; text-align: center; border-radius: 22px;
  background: $surface; box-shadow: $shadow-lg; animation: pop .25s $ease-out;
  display: flex; flex-direction: column; align-items: center;
  h3 { font-size: 18px; margin-top: 10px; }
  &__icon { width: 56px; height: 56px; border-radius: 16px; display: grid; place-items: center; background: $primary-soft; color: $primary; }
  &__reason { margin: 6px 0 2px; color: $text-2; }
  &__perm { margin: 0 0 18px; font-size: 12px; }
  &__error { min-height: 20px; margin: 10px 0 0; color: $danger; font-size: 13px; font-weight: 500; }
}
</style>
