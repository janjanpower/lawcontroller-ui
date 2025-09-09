// vite.config.ts
import { defineConfig } from "file:///home/project/node_modules/vite/dist/node/index.js";
import react from "file:///home/project/node_modules/@vitejs/plugin-react/dist/index.mjs";
var vite_config_default = defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, "/api")
      }
    }
  },
  optimizeDeps: {
    include: ["xlsx"],
    // ✅ 讓 Vite 預先處理 xlsx，避免解析失敗
    exclude: ["lucide-react"]
    // 你原本的設定保留
  }
  // 如果你有 SSR（通常沒有），遇到 xlsx 被外部化問題可打開這行：
  // ssr: { noExternal: ['xlsx'] },
  // 若還是有 CJS/ESM 解析問題，可再加這段保險（通常不需要）：
  // build: {
  //   commonjsOptions: { include: [/node_modules/] },
  // },
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9wcm9qZWN0XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS9wcm9qZWN0L3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL3Byb2plY3Qvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XG5cbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbcmVhY3QoKV0sXG4gIHNlcnZlcjoge1xuICAgIGhvc3Q6ICcwLjAuMC4wJyxcbiAgICBwb3J0OiA1MTczLFxuICAgIHByb3h5OiB7XG4gICAgICAnL2FwaSc6IHtcbiAgICAgICAgdGFyZ2V0OiAnaHR0cDovL2xvY2FsaG9zdDo4MDAwJyxcbiAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgICBzZWN1cmU6IGZhbHNlLFxuICAgICAgICByZXdyaXRlOiAocGF0aCkgPT4gcGF0aC5yZXBsYWNlKC9eXFwvYXBpLywgJy9hcGknKSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSxcbiAgb3B0aW1pemVEZXBzOiB7XG4gICAgaW5jbHVkZTogWyd4bHN4J10sICAgICAgICAgIC8vIFx1MjcwNSBcdThCOTMgVml0ZSBcdTk4MTBcdTUxNDhcdTg2NTVcdTc0MDYgeGxzeFx1RkYwQ1x1OTA3Rlx1NTE0RFx1ODlFM1x1Njc5MFx1NTkzMVx1NjU1N1xuICAgIGV4Y2x1ZGU6IFsnbHVjaWRlLXJlYWN0J10sICAvLyBcdTRGNjBcdTUzOUZcdTY3MkNcdTc2ODRcdThBMkRcdTVCOUFcdTRGRERcdTc1NTlcbiAgfSxcbiAgLy8gXHU1OTgyXHU2NzlDXHU0RjYwXHU2NzA5IFNTUlx1RkYwOFx1OTAxQVx1NUUzOFx1NkM5Mlx1NjcwOVx1RkYwOVx1RkYwQ1x1OTA0N1x1NTIzMCB4bHN4IFx1ODhBQlx1NTkxNlx1OTBFOFx1NTMxNlx1NTU0Rlx1OTg0Q1x1NTNFRlx1NjI1M1x1OTU4Qlx1OTAxOVx1ODg0Q1x1RkYxQVxuICAvLyBzc3I6IHsgbm9FeHRlcm5hbDogWyd4bHN4J10gfSxcblxuICAvLyBcdTgyRTVcdTkwODRcdTY2MkZcdTY3MDkgQ0pTL0VTTSBcdTg5RTNcdTY3OTBcdTU1NEZcdTk4NENcdUZGMENcdTUzRUZcdTUxOERcdTUyQTBcdTkwMTlcdTZCQjVcdTRGRERcdTk2QUFcdUZGMDhcdTkwMUFcdTVFMzhcdTRFMERcdTk3MDBcdTg5ODFcdUZGMDlcdUZGMUFcbiAgLy8gYnVpbGQ6IHtcbiAgLy8gICBjb21tb25qc09wdGlvbnM6IHsgaW5jbHVkZTogWy9ub2RlX21vZHVsZXMvXSB9LFxuICAvLyB9LFxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXlOLFNBQVMsb0JBQW9CO0FBQ3RQLE9BQU8sV0FBVztBQUdsQixJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTLENBQUMsTUFBTSxDQUFDO0FBQUEsRUFDakIsUUFBUTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sT0FBTztBQUFBLE1BQ0wsUUFBUTtBQUFBLFFBQ04sUUFBUTtBQUFBLFFBQ1IsY0FBYztBQUFBLFFBQ2QsUUFBUTtBQUFBLFFBQ1IsU0FBUyxDQUFDLFNBQVMsS0FBSyxRQUFRLFVBQVUsTUFBTTtBQUFBLE1BQ2xEO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLGNBQWM7QUFBQSxJQUNaLFNBQVMsQ0FBQyxNQUFNO0FBQUE7QUFBQSxJQUNoQixTQUFTLENBQUMsY0FBYztBQUFBO0FBQUEsRUFDMUI7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFRRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
