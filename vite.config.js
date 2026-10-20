import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // Đường dẫn tương đối: chạy được cả ở tên-miền/ lẫn ten.github.io/dreamers-pos/ (GitHub Pages)
  base: './',
  plugins: [
    vue(),
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
