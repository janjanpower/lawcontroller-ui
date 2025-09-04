import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      external: ["fs", "path", "os"], // 把 Node 模組標記成 external
    },
  },
});
