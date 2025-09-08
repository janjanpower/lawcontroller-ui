import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, '/api'),
      },
    },
  },
  optimizeDeps: {
    include: ['xlsx'],          // ✅ 讓 Vite 預先處理 xlsx，避免解析失敗
    exclude: ['lucide-react'],  // 你原本的設定保留
  },
  // 如果你有 SSR（通常沒有），遇到 xlsx 被外部化問題可打開這行：
  // ssr: { noExternal: ['xlsx'] },

  // 若還是有 CJS/ESM 解析問題，可再加這段保險（通常不需要）：
  // build: {
  //   commonjsOptions: { include: [/node_modules/] },
  // },
});
