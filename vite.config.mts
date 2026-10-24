import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { cloudflare } from "@cloudflare/vite-plugin";

// `vite dev` runs the Worker (local D1/R2/Analytics Engine) alongside the site.
export default defineConfig({
  plugins: [vue(), cloudflare()],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
});
