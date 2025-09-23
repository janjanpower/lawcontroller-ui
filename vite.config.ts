import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000', // 你的 FastAPI API
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, '/api'),
      },
    },
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react/jsx-runtime', // ✅ 確保 runtime 不會被 tree-shaking
      'xlsx',
    ],
    exclude: ['lucide-react'], // 保留動態 ESM 載入
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react/jsx-runtime'],
          'vendor-xlsx': ['xlsx'],
        },
      },
    },
    target: 'es2019', // ✅ 確保壓縮後語法不會過度優化
    sourcemap: true,  // 建議開啟方便除錯
    minify: 'terser', // ✅ 使用 terser 避免 esbuild mangle runtime 名稱
    terserOptions: {
      mangle: { keep_fnames: true, keep_classnames: true },
      compress: { passes: 2 },
    },
  },
});
