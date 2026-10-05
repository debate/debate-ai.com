"use client";

import { useAccountFlowSettingsSync } from "../lib/config/useAccountFlowSettingsSync";

/** Mounts the account settings sync for a web host. Renders nothing. */
export default function AccountSettingsSync() {
    useAccountFlowSettingsSync();
    return null;
}
