"use client";

import { useFlowSettingsLiveUpdate } from "../../lib/config/settingsLiveUpdate";
import { useAccountFlowSettingsSync } from "../../lib/config/useAccountFlowSettingsSync";

/**
 * Mounts the account settings sync for a web host, and follows settings the
 * tool-record sync (or another tab) writes while the editor is open. Renders
 * nothing.
 */
export default function AccountSettingsSync() {
    useAccountFlowSettingsSync();
    useFlowSettingsLiveUpdate();
    return null;
}
