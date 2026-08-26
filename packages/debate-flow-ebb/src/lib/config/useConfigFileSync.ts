"use client";

import { useEffect } from "react";

import { startConfigSync } from "./configFile";

/**
 * Mounts the desktop config-file sync for the app's lifetime. No-op on web.
 */
export function useConfigFileSync(): void {
    useEffect(() => startConfigSync(), []);
}
