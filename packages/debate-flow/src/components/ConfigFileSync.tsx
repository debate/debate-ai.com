"use client";

import { useConfigFileSync } from "../lib/config/useConfigFileSync";

/**
 * Mounts the desktop config-file sync app-wide. Rendered once in the root
 * layout so config.toml is created and sourced on boot regardless of route -
 * the dashboard opens first, before any flow, and the file must sync there too.
 * No-op on web. Renders nothing.
 */
export default function ConfigFileSync() {
    useConfigFileSync();
    return null;
}
