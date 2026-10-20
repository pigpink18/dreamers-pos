<script setup>
/** Kênh đặt phòng: đồng bộ lịch với Booking.com / Airbnb qua iCal */
import { ref, reactive, computed, onMounted } from 'vue'
import Icon from '../ui/Icon.vue'
import AppSelect from '../ui/AppSelect.vue'
import { useRooms } from '../../stores/rooms'
import { useSettings } from '../../stores/settings'
import { useUi } from '../../stores/ui'
import { useAudit } from '../../stores/audit'
import { CHANNELS, syncChannels, startAutoSync } from '../../channels/ical'
import { sync } from '../../sync/engine'
import { fmtDateTime } from '../../utils/format'

const rooms = useRooms()
const settings = useSettings()
const ui = useUi()
const links = reactive(Object.fromEntries(rooms.rooms.map((r) => [r.id, { booking: r.ical?.booking || '', airbnb: r.ical?.airbnb || '' }])))
const busy = ref(false)
const online = computed(() => sync.status.state === 'online')
const exportLinks = ref({}) // roomId -> base url có token

function save() {
  for (const r of rooms.rooms) {
    const l = links[r.id]
    for (const ch of Object.keys(CHANNELS)) {
      const v = (l[ch] || '').trim()
      if (v && !/^https:\/\/.+/.test(v)) return ui.toast(`Link ${CHANNELS[ch].label} của phòng ${r.name} phải bắt đầu bằng https://`, 'error')
    }
  }
  rooms.rooms.forEach((r) => (r.ical = { booking: links[r.id].booking.trim(), airbnb: links[r.id].airbnb.trim() }))
  useAudit().log('settings.update', 'Sửa link lịch Booking.com / Airbnb')
  startAutoSync()
  ui.toast('Đã lưu link lịch')
}

async function syncNow() {
  save()
  busy.value = true
  try {
    const r = await syncChannels()
    if (r.errors.length) ui.toast(r.errors[0], 'error')
    else ui.toast(`Đã đồng bộ: ${r.added} đặt mới · ${r.updated} đổi ngày · ${r.cancelled} huỷ`)
  } finally { busy.value = false }
}

// Link xuất lịch cho từng phòng (cần máy chủ)
async function loadExport() {
  if (!online.value) return
  const { getClient, getConfig } = await import('../../sync/connection')
  const c = getClient(), cfg = getConfig()
  if (!c || !cfg) return
  const ids = rooms.rooms.map((r) => r.id)
  let { data } = await c.from('ical_tokens').select('room_id,token').in('room_id', ids)
  const missing = ids.filter((id) => !data?.some((t) => t.room_id === id))
  if (missing.length) {
    await c.from('ical_tokens').insert(missing.map((room_id) => ({ room_id })))
    ;({ data } = await c.from('ical_tokens').select('room_id,token').in('room_id', ids))
  }
  const base = cfg.url.replace(/\/$/, '') + '/functions/v1/ical'
  exportLinks.value = Object.fromEntries((data || []).map((t) => [t.room_id, `${base}?room=${encodeURIComponent(t.room_id)}&token=${t.token}`]))
}
onMounted(() => loadExport().catch(() => {}))
async function copy(text) {
  try { await navigator.clipboard.writeText(text); ui.toast('Đã sao chép link') } catch { ui.toast('Không sao chép được — chọn và copy thủ công', 'error') }
}
</script>

<template>
  <section class="card">
    <div class="card__header">
      <h3>Kênh đặt phòng</h3><div class="spacer"></div>
      <button class="btn btn--ghost btn--sm" :disabled="busy" @click="syncNow"><Icon name="fa-arrows-rotate" :size="14" />{{ busy ? 'Đang đồng bộ…' : 'Đồng bộ ngay' }}</button>
    </div>
    <div class="card__body">
      <p class="muted" style="margin: 0 0 6px">
        Đồng bộ lịch phòng với <b>Booking.com</b> và <b>Airbnb</b> qua iCal — miễn phí, không cần channel manager.
        Khách đặt trên OTA sẽ tự hiện trên Sơ đồ phòng & Lịch đặt phòng; khách đặt tại quán sẽ khoá ngày trên OTA.
      </p>
      <p class="muted" style="margin: 0 0 16px; font-size: 12px">
        <Icon name="fa-circle-info" :size="12" /> iCal chỉ có ngày bận (không có tên khách, giá). Booking.com / Airbnb thường cập nhật lịch mỗi 1–3 giờ, nên vẫn có khả năng trùng phòng trong khoảng đó.
      </p>

      <div class="ch-meta">
        <div class="switch-row" style="flex: 1">
          <span><b>Tự đồng bộ khi app đang mở</b><small>{{ settings.channels.lastSync ? 'Lần cuối: ' + fmtDateTime(settings.channels.lastSync) : 'Chưa đồng bộ lần nào' }}</small></span>
          <AppSelect v-model="settings.channels.autoSyncMin" @update:model-value="startAutoSync" :options="[{ value: 0, label: 'Tắt' }, { value: 15, label: 'Mỗi 15 phút' }, { value: 30, label: 'Mỗi 30 phút' }, { value: 60, label: 'Mỗi giờ' }]" style="width: 160px" />
        </div>
      </div>
      <div v-if="settings.channels.lastResult?.errors?.length" class="ch-err">
        <Icon name="alert" :size="14" />{{ settings.channels.lastResult.errors.join(' · ') }}
      </div>

      <div class="ch-rooms">
        <div v-for="r in rooms.rooms" :key="r.id" class="ch-room">
          <div class="ch-room__name"><b>{{ r.name }}</b><small class="muted">{{ r.type }}</small></div>
          <div class="ch-room__fields">
            <label v-for="(c, k) in CHANNELS" :key="k" class="ch-field">
              <span>{{ c.label }} → Dreamers</span>
              <input class="input" v-model="links[r.id][k]" :placeholder="`Dán link 'Xuất lịch' từ ${c.label}`" autocomplete="off" />
            </label>
            <div class="ch-field">
              <span>Dreamers → OTA (dán vào mục "Nhập lịch")</span>
              <div v-if="exportLinks[r.id]" class="ch-export">
                <button v-for="(c, k) in CHANNELS" :key="k" type="button" class="btn btn--ghost btn--sm" @click="copy(`${exportLinks[r.id]}&exclude=${k}`)"><Icon name="fa-copy" :size="13" />Link cho {{ c.label }}</button>
              </div>
              <small v-else class="muted">{{ online ? 'Đang tạo link…' : 'Cần kết nối máy chủ (Cài đặt › Đồng bộ) để có link xuất lịch' }}</small>
            </div>
          </div>
        </div>
      </div>
      <div class="mt-16"><button class="btn btn--primary" @click="save"><Icon name="check" :size="15" />Lưu link</button></div>
    </div>
  </section>
</template>

<style lang="scss">
@use '../../styles/tokens' as *;
.ch-meta { display: flex; gap: 12px; margin-bottom: 12px; .switch-row > span { display: flex; flex-direction: column; gap: 2px; } }
.ch-err { display: flex; gap: 8px; align-items: center; padding: 10px 12px; border-radius: 10px; background: $danger-soft; color: $danger; font-size: 12px; margin-bottom: 12px; }
.ch-rooms { display: flex; flex-direction: column; border-top: 1px solid $border; }
.ch-room { display: grid; grid-template-columns: 120px 1fr; gap: 16px; padding: 16px 0; border-bottom: 1px solid $border;
  &__name { display: flex; flex-direction: column; gap: 2px; padding-top: 6px; }
  &__fields { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 12px; }
  @include mobile { grid-template-columns: 1fr; gap: 8px; &__fields { grid-template-columns: 1fr; } }
}
.ch-field { display: flex; flex-direction: column; gap: 5px; span { font-size: 12px; font-weight: 500; color: $text-2; } &:last-child { grid-column: 1 / -1; } }
.ch-export { display: flex; gap: 8px; flex-wrap: wrap; }
</style>
