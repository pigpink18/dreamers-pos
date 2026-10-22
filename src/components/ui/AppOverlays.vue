<script setup>
/** Thông báo (toast) + hộp xác nhận — hiện trên MỌI màn hình (kể cả màn PIN, màn tài khoản) */
import Icon from '../ui/Icon.vue'
import { useUi } from '../../stores/ui'
const ui = useUi()
</script>

<template>
  <!-- Toast -->
  <div class="toasts">
    <TransitionGroup name="toast">
    <div v-for="t in ui.toasts" :key="t.id" class="toast" :class="t.type">
      <Icon :name="t.type === 'error' ? 'alert' : 'check'" :size="15" /> {{ t.message }}
    </div>
    </TransitionGroup>
  </div>

  <!-- Hộp xác nhận kiểu alert của macOS/iOS -->
  <Teleport to="body">
    <div v-if="ui.confirmState" class="modal-backdrop modal-backdrop--top alert-backdrop" @click.self="ui.closeConfirm(false)">
    <div class="alert">
      <h3>{{ ui.confirmState.title }}</h3>
      <p>{{ ui.confirmState.message }}</p>
      <div class="alert__actions">
      <button class="btn btn--ghost" @click="ui.closeConfirm(false)">Huỷ</button>
      <button class="btn" :class="ui.confirmState.danger ? 'btn--danger' : 'btn--primary'" @click="ui.closeConfirm(true)" autofocus>
        {{ ui.confirmState.okText }}
      </button>
      </div>
    </div>
    </div>
  </Teleport>
</template>
