import { defineConfig } from "vite";

export default defineConfig({
  server: {
    https: false, // ← Ubah jadi false untuk development
    port: 3000,
    host: true, // Allow access from network
  },
  build: {
    target: "esnext",
    minify: "terser",
    rollupOptions: {
      output: {
        manualChunks: {
          three: ["three"],
        },
      },
    },
  },
});
