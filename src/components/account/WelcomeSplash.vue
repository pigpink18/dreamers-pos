<script setup>
/**
 * MÀN CHÀO khi mở trang tài khoản (kiểu mở máy Apple):
 * biểu tượng app nảy lên + hơi cà phê bốc lên, chữ "Chào mừng bạn" hiện từng chữ, thanh tải chạy,
 * rồi mờ dần để lộ form đăng nhập. Chạm vào để bỏ qua. Mỗi phiên trình duyệt chỉ hiện 1 lần.
 */
import { ref, onMounted, onBeforeUnmount } from 'vue'
import logo from '../../assets/image/logo.png'

const props = defineProps({ duration: { type: Number, default: 2400 } })
const emit = defineEmits(['done'])
const leaving = ref(false)
const WORDS = ['Chào', 'mừng', 'bạn']
let t1, t2

function finish() {
  if (leaving.value) return
  leaving.value = true
  clearTimeout(t1)
  t2 = setTimeout(() => emit('done'), 520) // chờ hiệu ứng mờ dần xong
}
onMounted(() => { t1 = setTimeout(finish, props.duration) })
onBeforeUnmount(() => { clearTimeout(t1); clearTimeout(t2) })
</script>

<template>
  <div class="splash" :class="{ 'is-leaving': leaving }" role="status" aria-label="Đang mở Dreamers POS" @click="finish">
    <div class="splash__glow" aria-hidden="true"></div>

    <div class="splash__cup">
      <!-- 3 làn hơi cà phê -->
      <svg class="splash__steam" viewBox="0 0 120 70" aria-hidden="true">
        <path d="M30 66 C 22 52, 40 44, 32 30 S 38 10, 30 2" />
        <path d="M60 66 C 52 50, 70 42, 60 28 S 68 8, 60 0" />
        <path d="M90 66 C 82 52, 100 44, 92 30 S 98 10, 90 2" />
      </svg>
      <div class="splash__icon"><img :src="logo" alt="" /></div>
    </div>

    <h1 class="splash__hello">
      <span v-for="(w, i) in WORDS" :key="w" :style="{ animationDelay: 700 + i * 110 + 'ms' }">{{ w }}</span>
    </h1>
    <p class="splash__sub">Dreamers POS · Bán hàng &amp; homestay</p>
    <div class="splash__bar" aria-hidden="true"><span :style="{ animationDuration: duration - 500 + 'ms' }"></span></div>
    <p class="splash__skip">Chạm để bỏ qua</p>
  </div>
</template>

<style lang="scss">
@use '../../styles/tokens' as *;
.splash {
  position: fixed; inset: 0; z-index: 50; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
  background: var(--bg); cursor: pointer; overflow: hidden; -webkit-tap-highlight-color: transparent;
  transition: opacity .5s $ease-out, transform .55s $ease-out, filter .5s $ease-out;
  &.is-leaving { opacity: 0; transform: scale(1.06); filter: blur(6px); pointer-events: none; }

  // quầng sáng màu cà phê thở nhẹ phía sau
  &__glow {
    position: absolute; width: 520px; height: 520px; border-radius: 50%; top: 50%; left: 50%; margin: -330px 0 0 -260px;
    background: radial-gradient(circle, color-mix(in srgb, var(--primary) 26%, transparent), transparent 65%);
    animation: splashGlow 2.6s ease-in-out infinite alternate, splashFade .9s $ease-out both;
  }
  &__cup { position: relative; display: flex; flex-direction: column; align-items: center; margin-bottom: 18px; }
  &__steam {
    width: 96px; height: 56px; margin-bottom: -6px; overflow: visible;
    path {
      fill: none; stroke: var(--primary); stroke-width: 3.2; stroke-linecap: round; opacity: 0;
      stroke-dasharray: 90; stroke-dashoffset: 90;
      animation: splashSteam 2s ease-out infinite;
      &:nth-child(1) { animation-delay: .55s; }
      &:nth-child(2) { animation-delay: .8s; }
      &:nth-child(3) { animation-delay: 1.05s; }
    }
  }
  &__icon {
    width: 96px; height: 96px; border-radius: 24px; background: #fff; display: grid; place-items: center;
    box-shadow: 0 0 0 .5px rgba(0, 0, 0, .08), 0 18px 40px -14px rgba(60, 35, 15, .45), 0 3px 8px rgba(60, 35, 15, .1);
    animation: splashPop .9s cubic-bezier(.2, 1.4, .3, 1) both;
    img { width: 74%; height: 74%; object-fit: contain; }
  }
  &__hello {
    margin: 0; display: flex; gap: .28em; font: 700 34px/1.1 $font-display; letter-spacing: -0.035em; color: $text;
    span { display: inline-block; opacity: 0; animation: splashWord .6s $ease-out both; }
  }
  &__sub { margin: 4px 0 0; font-size: 14px; color: $text-2; opacity: 0; animation: splashWord .6s $ease-out 1.1s both; }
  &__bar {
    width: 132px; height: 3px; margin-top: 26px; border-radius: 3px; background: color-mix(in srgb, var(--text) 10%, transparent); overflow: hidden;
    opacity: 0; animation: splashFade .4s ease-out .5s both;
    span { display: block; height: 100%; width: 100%; border-radius: inherit; background: var(--primary); transform-origin: left; transform: scaleX(0);
      animation: splashBar 1.9s cubic-bezier(.4, 0, .2, 1) .5s forwards; }
  }
  &__skip { position: absolute; bottom: calc(28px + var(--safe-bottom)); margin: 0; font-size: 12px; color: $text-muted; opacity: 0; animation: splashFade .6s ease-out 1.4s both; }
}
@keyframes splashPop { 0% { opacity: 0; transform: scale(.55) translateY(14px); filter: blur(8px); } 60% { opacity: 1; filter: blur(0); } 100% { opacity: 1; transform: none; filter: none; } }
@keyframes splashWord { from { opacity: 0; transform: translateY(12px); filter: blur(4px); } to { opacity: 1; transform: none; filter: none; } }
@keyframes splashFade { from { opacity: 0; } to { opacity: 1; } }
@keyframes splashBar { to { transform: scaleX(1); } }
@keyframes splashGlow { from { transform: scale(.92); } to { transform: scale(1.08); } }
@keyframes splashSteam {
  0% { opacity: 0; stroke-dashoffset: 90; transform: translateY(8px); }
  35% { opacity: .55; }
  100% { opacity: 0; stroke-dashoffset: 0; transform: translateY(-10px); }
}
</style>
