import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
  },
  build: {
    rollupOptions: {
      // 多页面入口：原 index.html 保持不变，追加预实验版 pilot.html 与数据下载页 download.html
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        pilot: fileURLToPath(new URL('./pilot.html', import.meta.url)),
        download: fileURLToPath(new URL('./download.html', import.meta.url)),
      },
    },
  },
});
