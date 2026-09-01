import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react'; // 🎯 Fixed the name here!

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5001', // 🎯 Changed localhost to 127.0.0.1 to match your backend!
        changeOrigin: true,
        secure: false,
      },
    },
  },
});