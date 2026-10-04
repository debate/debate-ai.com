"use client";

import { useEffect } from "react";

import { startFlowSettingsSync } from "../lib/sync/accountSettingsClient";
import { useFlowStore } from "../lib/store/useFlowStore";

/** Mounts the flow-editor account settings sync (no-op signed out). Renders nothing. */
export default function AccountSettingsSync() {
    useEffect(() => startFlowSettingsSync(useFlowStore), []);
    return null;
}
