<script setup>
/**
 * TỔNG QUAN
 *  1. Doanh thu hôm nay theo giờ (cộng dồn) so với hôm qua + 4 thẻ số liệu có đường xu hướng
 *  2. Doanh thu N ngày (7/14/30) + cơ cấu thanh toán
 *  3. Món bán chạy · Hoá đơn gần đây · Phòng hôm nay
 */
import { ref, computed } from 'vue'
import Icon from '../components/ui/Icon.vue'
import BarChart from '../components/ui/BarChart.vue'
import TrendChart from '../components/ui/TrendChart.vue'
import Sparkline from '../components/ui/Sparkline.vue'
import InvoiceDetailModal from '../components/invoices/InvoiceDetailModal.vue'
import { useInvoices, PAY_METHODS } from '../stores/invoices'
import { useRooms, ROOM_STATUS } from '../stores/rooms'
import { useProducts } from '../stores/products'
import { useAuth } from '../stores/auth'
import { aggregate } from '../utils/report'
import { useCountUp } from '../utils/motion'
import { money, moneyShort, number, pct, dateKey, addDays, fmtTime, fmtDate, parseKey, weekday } from '../utils/format'

const invoices = useInvoices()
const rooms = useRooms()
const products = useProducts()
const auth = useAuth()
const today = dateKey()
const now = new Date()

// ---------- Khoảng N ngày gần nhất (mỗi cột = 1 ngày) ----------
function daysRange(n, endKey = today) {
  const first = addDays(endKey, -(n - 1))
  const buckets = []
  for (let i = 0; i < n; i++) {
    const d = addDays(first, i)
    buckets.push({ key: d, label: n > 14 ? String(parseKey(d).getDate()) : `${weekday(d)} ${parseKey(d).getDate()}`, full: `${weekday(d)}, ${fmtDate(d)}`, start: parseKey(d), end: parseKey(addDays(d, 1)) })
  }
  return { start: parseKey(first), end: parseKey(addDays(endKey, 1)), buckets }
}

// ---------- 1. Hôm nay theo giờ, cộng dồn ----------
const HOURS = Array.from({ length: 17 }, (_, i) => i + 6) // 6h → 22h
function cumulative(dayKey, upToHour = 24) {
  const start = parseKey(dayKey).getTime()
  const per = new Array(24).fill(0)
  let count = 0
  for (const i of invoices.items) {
    if (i.status !== 'completed') continue
    const t = new Date(i.createdAt).getTime() - start
    if (t < 0 || t >= 864e5) continue
    per[Math.floor(t / 36e5)] += i.total
    count++
  }
  let acc = per.slice(0, 6).reduce((a, b) => a + b, 0)
  return { values: HOURS.map((h) => { acc += per[h]; return h <= upToHour ? acc : null }), count }
}
const todayCum = computed(() => cumulative(today, now.getHours()))
const yestCum = computed(() => cumulative(addDays(today, -1)))
const todayRevenue = computed(() => todayCum.value.values.filter((v) => v != null).at(-1) || 0)
// So với hôm qua tính tới cùng giờ
const yestSameTime = computed(() => {
  const idx = HOURS.indexOf(Math.min(22, Math.max(6, now.getHours())))
  return yestCum.value.values[idx] || 0
})
const todayChange = computed(() => pct(todayRevenue.value, yestSameTime.value))
const heroValue = useCountUp(() => money(todayRevenue.value))
const hourSeries = computed(() => [
  { key: 'today', label: 'Hôm nay', values: todayCum.value.values, color: 'var(--chart-1)', area: true },
  { key: 'yest', label: 'Hôm qua', values: yestCum.value.values, color: 'var(--text-muted)', dashed: true },
])

// ---------- Thẻ số liệu nhỏ (xu hướng 14 ngày) ----------
const d14 = computed(() => aggregate(invoices.items, daysRange(14)))
const todayAgg = computed(() => d14.value.buckets.at(-1))
const avgTicket = computed(() => (todayAgg.value.count ? todayAgg.value.total / todayAgg.value.count : 0))
const monthAgg = computed(() => {
  return aggregate(invoices.items, daysRange(+today.slice(8)))
})
const occupancy = computed(() => (rooms.rooms.length ? Math.round((rooms.summary.occupied / rooms.rooms.length) * 100) : 0))
const RING = 2 * Math.PI * 26

// ---------- 2. Doanh thu N ngày ----------
const span = ref(14)
const rangeAgg = computed(() => aggregate(invoices.items, daysRange(span.value)))
const prevAgg = computed(() => aggregate(invoices.items, daysRange(span.value, addDays(today, -span.value))))
const rangeChange = computed(() => pct(rangeAgg.value.revenue, prevAgg.value.revenue))
const SERIES = [
  { key: 'retail', label: 'Café & bánh', color: 'var(--chart-1)' },
  { key: 'room', label: 'Tiền phòng', color: 'var(--chart-2)' },
]
const methods = computed(() => {
  const m = rangeAgg.value.methods, total = rangeAgg.value.revenue || 1
  return Object.entries(PAY_METHODS).map(([k, label]) => ({ k, label, v: m[k] || 0, p: Math.round(((m[k] || 0) / total) * 100) }))
})
const split = computed(() => {
  const r = rangeAgg.value, t = r.revenue || 1
  return { retail: (r.retail / t) * 100, room: (r.room / t) * 100 }
})

// ---------- 3. Món bán chạy (7 ngày), hoá đơn gần đây, phòng ----------
const topItems = computed(() => {
  const list = Object.values(aggregate(invoices.items, daysRange(7)).products).sort((a, b) => b.revenue - a.revenue).slice(0, 6)
  const max = list[0]?.revenue || 1
  return list.map((p) => ({ ...p, w: (p.revenue / max) * 100 }))
})
const recent = computed(() => invoices.items.slice(0, 6))
const arrivals = computed(() => rooms.bookings.filter((b) => b.status === 'booked' && b.checkIn <= today))
const departures = computed(() => rooms.bookings.filter((b) => b.status === 'staying' && b.checkOut <= today))
const openId = ref(null)

const hello = computed(() => {
  const h = now.getHours()
  const g = h < 11 ? 'Chào buổi sáng' : h < 14 ? 'Chào buổi trưa' : h < 18 ? 'Chào buổi chiều' : 'Chào buổi tối'
  return `${g}, ${auth.user?.name || ''}`
})
const ST_ORDER = ['occupied', 'reserved', 'checkedout', 'vacant']
</script>

<template>
  <div class="page dash">
    <div class="page-header">
      <div><h1>{{ hello }}</h1><p>{{ weekday(today) }}, {{ fmtDate(today) }} · cập nhật lúc {{ fmtTime(now) }}</p></div>
      <div class="spacer"></div>
      <RouterLink v-if="auth.can('rooms.view')" to="/rooms" class="btn btn--ghost"><Icon name="bed" :size="16" />Sơ đồ phòng</RouterLink>
      <RouterLink v-if="auth.can('pos.sell')" to="/pos" class="btn btn--primary"><Icon name="cart" :size="16" />Bán hàng</RouterLink>
    </div>

    <!-- ============ 1. HÔM NAY ============ -->
    <section class="dash-top">
      <div class="card hero">
        <div class="hero__head">
          <div>
            <div class="eyebrow">Doanh thu hôm nay</div>
            <div class="hero__value num">{{ heroValue }}</div>
            <div class="hero__meta">
              <span v-if="todayChange !== null" class="delta" :class="todayChange >= 0 ? 'up' : 'down'">
                <Icon :name="todayChange >= 0 ? 'fa-arrow-up' : 'fa-arrow-down'" :size="11" />{{ Math.abs(todayChange).toFixed(1) }}%
              </span>
              <span class="muted">so với {{ moneyShort(yestSameTime) }} cùng giờ hôm qua</span>
            </div>
          </div>
          <div class="hero__legend">
            <span><i class="solid"></i>Hôm nay</span>
            <span><i class="is-dashed"></i>Hôm qua</span>
          </div>
        </div>
        <TrendChart :labels="HOURS.map((h) => h + 'h')" :full="HOURS.map((h) => `Đến ${h + 1}:00`)" :series="hourSeries" :height="210" />
      </div>

      <div class="tiles">
        <div class="card tile">
          <div class="eyebrow"><Icon name="receipt" :size="13" />Hoá đơn hôm nay</div>
          <div class="tile__row">
            <div class="tile__value num">{{ number(todayAgg.count) }}</div>
            <Sparkline :values="d14.buckets.map((b) => b.count)" color="var(--chart-1)" />
          </div>
          <div class="tile__hint muted">14 ngày · TB {{ (d14.count / 14).toFixed(1) }}/ngày</div>
        </div>
        <div class="card tile">
          <div class="eyebrow"><Icon name="fa-coins" :size="13" />TB mỗi hoá đơn</div>
          <div class="tile__row">
            <div class="tile__value num">{{ moneyShort(avgTicket) }}</div>
            <Sparkline :values="d14.buckets.map((b) => (b.count ? b.total / b.count : 0))" color="var(--chart-1)" />
          </div>
          <div class="tile__hint muted">14 ngày · {{ moneyShort(d14.count ? d14.revenue / d14.count : 0) }}/HĐ</div>
        </div>
        <div class="card tile">
          <div class="eyebrow"><Icon name="trend" :size="13" />Tháng này</div>
          <div class="tile__row">
            <div class="tile__value num">{{ moneyShort(monthAgg.revenue) }}</div>
            <Sparkline :values="monthAgg.buckets.map((b) => b.total)" color="var(--chart-1)" />
          </div>
          <div class="tile__hint muted">{{ number(monthAgg.count) }} hoá đơn</div>
        </div>
        <RouterLink to="/rooms" class="card tile tile--ring">
          <div class="eyebrow"><Icon name="bed" :size="13" />Công suất phòng</div>
          <div class="tile__row">
            <div class="tile__value num">{{ occupancy }}<small>%</small></div>
            <svg class="ring" width="60" height="60" viewBox="0 0 60 60" aria-hidden="true">
              <circle cx="30" cy="30" r="26" class="ring__track" />
              <circle cx="30" cy="30" r="26" class="ring__val" :style="{ strokeDasharray: `${(occupancy / 100) * RING} ${RING}` }" />
            </svg>
          </div>
          <div class="tile__hint muted">{{ rooms.summary.occupied }}/{{ rooms.rooms.length }} phòng có khách</div>
        </RouterLink>
      </div>
    </section>

    <!-- ============ 2. DOANH THU N NGÀY ============ -->
    <section class="dash-mid">
      <div class="card">
        <div class="card__header chart-head">
          <div>
            <h3>Doanh thu {{ span }} ngày</h3>
            <div class="chart-head__sum">
              <b class="num">{{ money(rangeAgg.revenue) }}</b>
              <span v-if="rangeChange !== null" class="delta" :class="rangeChange >= 0 ? 'up' : 'down'">
                <Icon :name="rangeChange >= 0 ? 'fa-arrow-up' : 'fa-arrow-down'" :size="11" />{{ Math.abs(rangeChange).toFixed(1) }}%
              </span>
              <span class="muted">so với {{ span }} ngày trước</span>
            </div>
          </div>
          <div class="spacer"></div>
          <div class="segmented">
            <button v-for="n in [7, 14, 30]" :key="n" :class="{ active: span === n }" @click="span = n">{{ n }} ngày</button>
          </div>
        </div>
        <div class="card__body">
          <BarChart :key="span" :data="rangeAgg.buckets" :series="SERIES" :height="250" average />
        </div>
      </div>

      <div class="card mix">
        <div class="card__header"><h3>Cơ cấu doanh thu</h3><span class="muted" style="margin-left: auto; font-size: 12px">{{ span }} ngày</span></div>
        <div class="card__body">
          <div class="split">
            <div class="split__bar">
              <span :style="{ width: split.retail + '%', background: 'var(--chart-1)' }"></span>
              <span :style="{ width: split.room + '%', background: 'var(--chart-2)' }"></span>
            </div>
            <div class="split__legend">
              <div><i style="background: var(--chart-1)"></i>Café & bánh<b class="num">{{ Math.round(split.retail) }}%</b><small class="num">{{ moneyShort(rangeAgg.retail) }}</small></div>
              <div><i style="background: var(--chart-2)"></i>Tiền phòng<b class="num">{{ Math.round(split.room) }}%</b><small class="num">{{ moneyShort(rangeAgg.room) }}</small></div>
            </div>
          </div>
          <div class="eyebrow" style="margin: 22px 0 10px">Hình thức thanh toán</div>
          <div class="meter-list">
            <div v-for="m in methods" :key="m.k" class="meter">
              <div class="meter__top"><span>{{ m.label }}</span><b class="num">{{ money(m.v) }}</b><small class="num">{{ m.p }}%</small></div>
              <div class="meter__track"><span :style="{ width: m.p + '%' }"></span></div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ============ 3. CHI TIẾT ============ -->
    <section class="dash-bottom">
      <div class="card">
        <div class="card__header"><h3>Bán chạy 7 ngày</h3><div class="spacer"></div><RouterLink v-if="auth.can('reports.view')" to="/reports" class="btn btn--ghost btn--sm">Báo cáo</RouterLink></div>
        <div class="card__body top-list">
          <div v-for="(p, i) in topItems" :key="p.name" class="top-item">
            <span class="top-item__rank num">{{ i + 1 }}</span>
            <div class="top-item__main">
              <div class="top-item__row"><span class="top-item__name">{{ p.name }}</span><b class="num">{{ moneyShort(p.revenue) }}</b></div>
              <div class="top-item__bar"><span :style="{ width: p.w + '%' }"></span></div>
              <small class="muted num">{{ p.qty }} đã bán</small>
            </div>
          </div>
          <div v-if="!topItems.length" class="empty">Chưa có dữ liệu bán hàng</div>
        </div>
      </div>

      <div class="card">
        <div class="card__header"><h3>Hoá đơn gần đây</h3><div class="spacer"></div><RouterLink to="/invoices" class="btn btn--ghost btn--sm">Tất cả</RouterLink></div>
        <div class="inv-list">
          <button v-for="i in recent" :key="i.id" class="inv-row" @click="openId = i.id">
            <span class="inv-row__icon" :class="i.type"><Icon :name="i.type === 'room' ? 'bed' : 'fa-mug-saucer'" :size="15" /></span>
            <div class="inv-row__main">
              <b>{{ i.customerName }}</b>
              <small class="muted">{{ i.code }} · {{ dateKey(i.createdAt) === today ? fmtTime(i.createdAt) : fmtDate(i.createdAt) }}</small>
            </div>
            <span class="num inv-row__amt" :class="{ void: i.status === 'cancelled' }">{{ money(i.total) }}</span>
          </button>
        </div>
      </div>

      <div class="card">
        <div class="card__header"><h3>Phòng hôm nay</h3><div class="spacer"></div><RouterLink to="/rooms" class="btn btn--ghost btn--sm">Sơ đồ</RouterLink></div>
        <div class="card__body">
          <div class="room-dots">
            <RouterLink v-for="r in rooms.rooms" :key="r.id" to="/rooms" class="room-dot" :class="`st-${rooms.statusOf(r)}`" :title="ROOM_STATUS[rooms.statusOf(r)].label">
              <i></i>{{ r.name }}
            </RouterLink>
          </div>
          <div class="room-sum">
            <div v-for="k in ST_ORDER" :key="k" :class="`st-${k}`"><i></i>{{ ROOM_STATUS[k].label }}<b class="num">{{ rooms.summary[k] }}</b></div>
          </div>
          <div class="todo">
            <div class="todo__item"><Icon name="login" :size="15" /><span>Khách đến hôm nay</span><b class="num">{{ arrivals.length }}</b></div>
            <div class="todo__item"><Icon name="logout" :size="15" /><span>Đến hạn trả phòng</span><b class="num">{{ departures.length }}</b></div>
            <RouterLink v-if="products.lowStock.length" to="/products" class="todo__item warn"><Icon name="alert" :size="15" /><span>Sắp hết hàng</span><b class="num">{{ products.lowStock.length }}</b></RouterLink>
          </div>
        </div>
      </div>
    </section>

    <InvoiceDetailModal v-if="openId" :invoice-id="openId" @close="openId = null" />
  </div>
</template>

<style lang="scss">
@use '../styles/tokens' as *;

.dash {
  .eyebrow { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: $text-2; letter-spacing: .01em; .icon { color: $text-muted; } }
  .delta {
    display: inline-flex; align-items: center; gap: 3px; padding: 2px 7px; border-radius: 99px; font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums;
    &.up { color: $success; background: $success-soft; } &.down { color: $danger; background: $danger-soft; }
  }
  section + section { margin-top: 16px; }
}

/* ---- Hàng 1 ---- */
.dash-top { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr); gap: 16px; }
.hero {
  padding: 20px 20px 12px;
  &__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
  &__value { font: 700 38px/1.1 $font-display; letter-spacing: -0.035em; margin-top: 6px; }
  &__meta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 8px; font-size: 13px; }
  &__legend { display: flex; gap: 14px; font-size: 12px; color: $text-2;
    span { display: inline-flex; align-items: center; gap: 6px; }
    i { width: 14px; height: 0; border-top: 2px solid var(--chart-1); &.is-dashed { border-top: 2px dashed $text-muted; } } }
}
.tiles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.tile {
  display: flex; flex-direction: column; gap: 10px; padding: 16px 18px; color: inherit; text-decoration: none; min-width: 0;
  &__row { display: flex; align-items: flex-end; justify-content: space-between; gap: 8px; margin-top: auto; }
  &__value { font: 700 26px/1 $font-display; letter-spacing: -0.03em; white-space: nowrap; small { font-size: 15px; color: $text-muted; margin-left: 1px; } }
  &__hint { font-size: 12px; }
  &--ring { transition: transform .25s $spring, box-shadow .2s; &:hover { transform: translateY(-2px); box-shadow: $shadow; } }
}
.ring { flex: none; transform: rotate(-90deg); margin: -10px 0 -4px;
  &__track { fill: none; stroke: var(--fill-2); stroke-width: 7; }
  &__val { fill: none; stroke: var(--chart-1); stroke-width: 7; stroke-linecap: round; transition: stroke-dasharray .8s $ease-out; }
}

/* ---- Hàng 2 ---- */
.dash-mid { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 16px; align-items: stretch; }
.chart-head { align-items: flex-start; flex-wrap: wrap; row-gap: 10px;
  &__sum { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 6px; font-size: 13px; b { font: 700 22px/1.1 $font-display; letter-spacing: -0.02em; } }
}
.split {
  &__bar { display: flex; gap: 2px; height: 10px; border-radius: 99px; overflow: hidden; background: var(--fill);
    span { display: block; height: 100%; transition: width .7s $ease-out; } }
  &__legend { display: flex; flex-direction: column; gap: 8px; margin-top: 14px; font-size: 13px; color: $text-2;
    div { display: flex; align-items: center; gap: 8px; }
    i { width: 10px; height: 10px; border-radius: 3px; flex: none; }
    b { margin-left: auto; color: $text; font-weight: 600; }
    small { width: 54px; text-align: right; color: $text-muted; font-size: 12px; } }
}
.meter-list { display: flex; flex-direction: column; gap: 14px; }
.meter {
  &__top { display: flex; align-items: baseline; gap: 8px; font-size: 13px; color: $text-2;
    b { margin-left: auto; color: $text; font-weight: 600; } small { width: 34px; text-align: right; color: $text-muted; font-size: 12px; } }
  &__track { height: 6px; margin-top: 6px; border-radius: 99px; background: var(--fill);
    span { display: block; height: 100%; border-radius: inherit; background: $text-2; opacity: .55; transition: width .7s $ease-out; } }
}

/* ---- Hàng 3 ---- */
.dash-bottom { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; align-items: start; }
.top-list { display: flex; flex-direction: column; gap: 14px; }
.top-item {
  display: flex; gap: 12px; align-items: flex-start;
  &__rank { width: 22px; height: 22px; flex: none; border-radius: 7px; display: grid; place-items: center; font-size: 11px; font-weight: 700; background: var(--fill); color: $text-2; }
  &__main { flex: 1; min-width: 0; }
  &__row { display: flex; gap: 8px; font-size: 13px; b { margin-left: auto; font-weight: 600; } }
  &__name { font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  &__bar { height: 6px; margin: 6px 0 3px; border-radius: 99px; background: var(--fill);
    span { display: block; height: 100%; border-radius: inherit; background: var(--chart-1); transition: width .7s $ease-out; } }
  small { font-size: 11px; }
}
.inv-list { padding: 4px 8px 8px; }
.inv-row {
  display: flex; align-items: center; gap: 12px; width: 100%; padding: 10px 12px; border: 0; background: transparent; border-radius: 12px;
  font: inherit; color: inherit; text-align: left; cursor: pointer; transition: background .15s;
  &:hover { background: var(--fill); }
  &__icon { width: 32px; height: 32px; flex: none; border-radius: 10px; display: grid; place-items: center; background: var(--fill); color: $text-2; }
  &__main { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.35;
    b { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } small { font-size: 12px; } }
  &__amt { font-weight: 600; font-size: 13px; &.void { color: $text-muted; text-decoration: line-through; } }
}
$st: (vacant: $success, reserved: $info, occupied: $danger, checkedout: $warning);
@each $k, $c in $st { .dash .st-#{$k} { --c: #{$c}; } }
.room-dots { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.room-dot {
  display: flex; align-items: center; gap: 7px; height: 38px; padding: 0 10px; border-radius: 10px; background: var(--fill);
  color: $text; font-size: 13px; font-weight: 600; text-decoration: none; transition: background .15s;
  &:hover { background: var(--fill-2); }
  i { width: 8px; height: 8px; border-radius: 50%; background: var(--c); flex: none; }
}
.room-sum { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 14px; margin-top: 14px; font-size: 12px; color: $text-2;
  div { display: flex; align-items: center; gap: 7px; } b { margin-left: auto; color: $text; }
  i { width: 8px; height: 8px; border-radius: 50%; background: var(--c); } }
.todo { margin-top: 16px; border-top: 1px solid $border; padding-top: 6px;
  &__item { display: flex; align-items: center; gap: 10px; padding: 8px 2px; font-size: 13px; color: $text-2; text-decoration: none;
    .icon { color: $text-muted; } b { margin-left: auto; color: $text; }
    &.warn { color: $warning; .icon { color: $warning; } } }
}

@media (max-width: 1280px) { .dash-bottom { grid-template-columns: 1fr 1fr; } .dash-bottom > :last-child { grid-column: 1 / -1; } }
@media (max-width: 1100px) { .dash-top, .dash-mid { grid-template-columns: minmax(0, 1fr); } }
@include mobile {
  .hero { padding: 16px 14px 8px; &__value { font-size: 32px; } &__head { flex-direction: column; } }
  .tiles { gap: 10px; }
  .tile { padding: 14px; &__value { font-size: 21px; } .spark { width: 64px; } .ring { width: 46px; height: 46px; } }
  .dash-bottom { grid-template-columns: minmax(0, 1fr); }
  .chart-head .segmented { width: 100%; button { flex: 1; } }
}
</style>
