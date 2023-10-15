import { defineManifest } from "@crxjs/vite-plugin";
import packageJson from "../package.json";

const { version, name, description } = packageJson;

// Convert from Semver (example: 0.1.0-beta6)
const [major, minor, patch] = version
    // can only contain digits, dots, or dash
    .replace(/[^\d.-]+/g, "")
    // split into version parts
    .split(/[.-]/);

export default defineManifest(async (env) => ({
    "manifest_version": 3,
    "name": "Debate Research AI",
    "description": description,
    "version": `${major}.${minor}.${patch}`,
    "version_name": version,
    "icons": {
      "32": "src/icons/icon-32.png",
      "48": "src/icons/icon-48.png",
      "128": "src/icons/icon-128.png"
    },
    "content_scripts": [
      {
        "matches": ["<all_urls>"],
        "js": ["src/pages/content/index.ts"]
      } 
    ],
    "side_panel": {
        "default_path": "src/pages/sidepanel/index.html",
    },
    "background": {
      "service_worker": "src/pages/background/index.ts"
    },
    "options_page": "src/pages/options/index.html",
    "action": {
      "default_popup": "src/pages/popup/index.html"
    },
    "permissions": ["sidePanel", "storage", "system.display", 
        "tabs", "unlimitedStorage", "identity", "identity.email"],
    "host_permissions": [
      "https://api.debate-ai.com/*",
      "https://api.debate-ai.com/*/*"
    ]
}));
