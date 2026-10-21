<script setup>
// Ô tìm khách hàng: gõ tên/SĐT, chọn từ danh sách hoặc thêm nhanh
import { ref, computed } from 'vue'
import Icon from '../ui/Icon.vue'
import CustomerFormModal from './CustomerFormModal.vue'
import { useCustomers } from '../../stores/customers'
import { normalize } from '../../utils/format'

const model = defineModel() // customerId
const customers = useCustomers()
const q = ref('')
const open = ref(false)
const showAdd = ref(false)

const selected = computed(() => customers.byId(model.value))
const results = computed(() => {
  const k = normalize(q.value)
  return customers.items.filter((c) => !k || normalize(c.name).includes(k) || (c.phone || '').includes(k)).slice(0, 8)
})
function choose(c) {
  model.value = c.id
  q.value = ''
  open.value = false
}
</script>

<template>
  <div class="cpicker">
    <div v-if="selected" class="cpicker__selected">
      <div class="cpicker__avatar">{{ selected.name.split(' ').pop()[0] }}</div>
      <div>
        <div class="fw-600">{{ selected.name }}</div>
        <div class="muted" style="font-size: 12px">{{ selected.code }} · {{ selected.phone || '—' }}</div>
      </div>
      <button class="btn btn--ghost btn--icon btn--sm" style="margin-left: auto" @click="model = null" aria-label="Bỏ chọn"><Icon name="x" :size="14" /></button>
    </div>
    <div v-else class="cpicker__search">
      <div class="search" style="flex: 1">
        <input class="input" v-model="q" placeholder="Tìm khách hàng (tên, SĐT)..." @focus="open = true" @blur="open = false" />
      </div>
      <button class="btn btn--ghost btn--icon" title="Thêm khách mới" @click="showAdd = true"><Icon name="plus" :size="16" /></button>
      <div v-if="open" class="cpicker__dropdown">
        <div v-for="c in results" :key="c.id" class="cpicker__item" @mousedown.prevent="choose(c)">
          <span class="fw-600">{{ c.name }}</span><span class="muted">{{ c.phone }}</span>
        </div>
        <div v-if="!results.length" class="cpicker__item muted" @mousedown.prevent="showAdd = true">
          Không tìm thấy — <a>+ Thêm "{{ q }}"</a>
        </div>
      </div>
    </div>
    <CustomerFormModal v-if="showAdd" :preset-name="/^[\d\s+.\-]+$/.test(q) ? '' : q" :preset-phone="/^[\d\s+.\-]+$/.test(q) ? q : ''" @close="showAdd = false" @saved="(id) => { model = id; q = '' }" />
  </div>
</template>

<style lang="scss">
@use '../../styles/tokens' as *;
.cpicker {
  position: relative;
  &__search { display: flex; gap: 6px; }
  &__selected { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border: 1px solid $border; border-radius: $radius-sm; background: $primary-soft; }
  &__avatar { width: 32px; height: 32px; border-radius: 50%; background: $primary; color: $on-primary; display: grid; place-items: center; font-weight: 600; }
  &__dropdown { position: absolute; top: 42px; left: 0; right: 40px; z-index: 30; background: $surface; border: 1px solid $border; border-radius: $radius-sm; box-shadow: $shadow; max-height: 280px; overflow-y: auto; }
  &__item { display: flex; justify-content: space-between; gap: 10px; padding: 9px 12px; cursor: pointer; &:hover { background: $primary-soft; } }
}
</style>
