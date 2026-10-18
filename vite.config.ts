import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// Fixed port so src-tauri/tauri.conf.json can point at it. The Rust build output is ignored
// by the watcher: on Windows, cargo locks files in src-tauri/target while compiling and
// Vite crashes with EBUSY trying to watch them.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: { port: 1420, strictPort: true, watch: { ignored: ['**/src-tauri/**'] } },
})
