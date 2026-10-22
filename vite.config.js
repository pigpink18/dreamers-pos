import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { createHash } from 'node:crypto'

/**
 * Bảo mật trình duyệt cho bản build (GitHub Pages không cho đặt header, nên dùng thẻ meta):
 * - Content-Security-Policy: chỉ chạy mã của chính app (+ đoạn script đổi theme có mã băm), chỉ kết nối tới máy chủ Supabase.
 *   Kể cả khi có ai chèn được nội dung lạ vào dữ liệu, trình duyệt cũng không chạy mã đó và không gửi dữ liệu đi nơi khác.
 * - Chặn trang khác nhúng app vào khung (iframe) để lừa bấm.
 */
function securityHeaders() {
  return {
    name: 'dreamers-security',
    apply: 'build',
    transformIndexHtml(html) {
      const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => `'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`)
      const sb = (process.env.VITE_SUPABASE_URL || '').replace(/^[A-Z0-9_]+\s*=\s*/, '').trim().replace(/\/$/, '')
      const sbOrigin = /^https:\/\//.test(sb) ? new URL(sb).origin : ''
      const connect = ["'self'", 'https://*.supabase.co', 'wss://*.supabase.co', sbOrigin, sbOrigin && sbOrigin.replace('https://', 'wss://'), 'https://fonts.googleapis.com', 'https://fonts.gstatic.com',
        // lịch iCal của các kênh đặt phòng (khi chưa có máy chủ thì app tải trực tiếp)
        'https://*.booking.com', 'https://*.airbnb.com', 'https://*.airbnb.com.vn', 'https://*.agoda.com', 'https://*.expedia.com', 'https://*.traveloka.com'].filter(Boolean)
      const csp = [
        "default-src 'self'",
        `script-src 'self' ${inline.join(' ')}`,
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' data: https://fonts.gstatic.com",
        "img-src 'self' data: blob:",
        `connect-src ${[...new Set(connect)].join(' ')}`,
        "worker-src 'self'",
        "manifest-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; ')
      return html
        .replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />\n    <meta name="referrer" content="strict-origin-when-cross-origin" />`)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  // Đường dẫn tương đối: chạy được cả ở tên-miền/ lẫn ten.github.io/dreamers-pos/ (GitHub Pages)
  base: './',
  plugins: [
    vue(),
    securityHeaders(),
    // Biến web thành app cài được (PWA): thêm vào màn hình chính, mở toàn màn hình, chạy offline
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Dreamers Home & Coffee',
        short_name: 'Dreamers',
        description: 'Bán hàng & quản lý homestay Dreamers',
        lang: 'vi',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        background_color: '#f6f1eb',
        theme_color: '#f6f1eb',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Bán hàng', url: './#/pos', icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Sơ đồ phòng', url: './#/rooms', icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
})
