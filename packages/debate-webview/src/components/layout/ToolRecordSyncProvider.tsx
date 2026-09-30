"use client"

/**
 * @fileoverview Mounts the shared tool-record sync (`useToolRecordSync`) for
 * the document it renders in, and renders nothing.
 *
 * It sits in `AppShell` in both of that component's branches — the full shell
 * and the bare page rendered when another site frames the app — because the
 * mirror's on/off flag is module state belonging to the document the tool
 * panels run in. The merge itself is deduped per tab by `useToolRecordSync`.
 *
 * @module components/layout/ToolRecordSyncProvider
 */

import { useToolRecordSync } from "../../lib/hooks/useToolRecordSync"

export function ToolRecordSyncProvider() {
  useToolRecordSync()
  return null
}
