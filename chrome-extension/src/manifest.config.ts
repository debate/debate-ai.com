import { defineManifest } from "@crxjs/vite-plugin";
import packageJson from "../package.json";

const { version, name, description } = packageJson;

// Convert from Semver (example: 0.1.0-beta6)
const [major, minor, patch] = version
  .replace(/[^\d.-]+/g, "").split(/[.-]/);

export default defineManifest(async (env) => ({
  manifest_version: 3,
  name: "BRO.AI Browser Research Organizer",
  description: description,
  version: `${major}.${minor}.${patch}`,
  version_name: version,
 
  background: {
    service_worker: "src/background/index.ts",
  },
  content_scripts: [
    {
      matches: ["https://*/*"],
      js: ["src/content/index.ts"],
    },
  ],
  side_panel: {
    default_path: "src/pages/sidepanel/index.html"
  },
  "options_ui": "src/pages/flow/index.html",

  "web_accessible_resources": [{
    "resources": ["src/pages/flow/index.html", "src/pages/editor/index.html"],
    "matches": ["<all_urls>"]
  }],
  permissions: [
    "sidePanel",
    "storage",
    "unlimitedStorage",
    "tabs",
    "identity",
    "identity.email",
  ],
  action: {
    "default_title": "Research Knowledge Base AI",
 },
  host_permissions: ["https://api.debate.com.co/*"],
  icons: {
    "32": "src/assets/icons/icon-32.png",
    "48": "src/assets/icons/icon-48.png",
    "128": "src/assets/icons/icon-128.png",
  },
}));
