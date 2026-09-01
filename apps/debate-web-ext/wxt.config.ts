import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Debate AI — Card Reuse Check",
    permissions: ["storage", "activeTab"],
    host_permissions: ["https://debate-ai.com/*", "http://localhost:3000/*"],
  },
});
