import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  // 🌟 核心修改：配置本地开发代理
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000', // 转发给 Python 后端
        changeOrigin: true,
      },
      '/thumbs': {
        target: 'http://127.0.0.1:8000', // 转发图片请求
        changeOrigin: true,
      }
    }
  }
})