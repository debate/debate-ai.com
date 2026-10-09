import { defineConfig } from "vitest/config"
import path from "node:path"

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}", "test/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "../../apps/debate-ai.com"),
      "@debate/webview-admin": path.resolve(__dirname, "./src"),
      "@debate/webview": path.resolve(__dirname, "../debate-webview/src"),
    },
  },
})
