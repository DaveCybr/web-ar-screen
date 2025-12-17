import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: true,
    target: "es2020",
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["aframe"],
        },
      },
    },
  },
  server: {
    port: 3000,
    https: false, // Set true for production with cert
    open: true,
  },
  resolve: {
    alias: {
      "@": "/src",
    },
  },
});
