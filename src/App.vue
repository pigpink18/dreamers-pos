<script setup>
import { useRoute } from 'vue-router'
import AppLayout from './layouts/AppLayout.vue'
import ApprovalModal from './components/auth/ApprovalModal.vue'
import AppOverlays from './components/ui/AppOverlays.vue'

const route = useRoute()
</script>

<template>
  <!-- Màn hình đăng nhập không có khung menu -->
  <RouterView v-if="route.meta.bare" />
  <AppLayout v-else-if="route.name" />
  <ApprovalModal />
  <AppOverlays />
</template>
