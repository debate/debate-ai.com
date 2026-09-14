"use client"

/**
 * @fileoverview Mounts the shared tool-record sync (`useToolRecordSync`) for
 * the document it renders in, and renders nothing.
 *
 * It sits in `AppShell` in both of that component's branches — the shell and
 * each framed dock destination — because a page's tool panels run inside the
 * frame, and the mirror's on/off flag is module state belonging to whichever
 * document those panels' stores were imported into. The merge itself is
 * deduped per tab by `useToolRecordSync`, so mounting it twice costs one
 * `sessionStorage` read, not a second round of requests.
 *
 * @module components/layout/ToolRecordSyncProvider
 */

import { useToolRecordSync } from "@/lib/hooks/useToolRecordSync"

export function ToolRecordSyncProvider() {
  useToolRecordSync()
  return null
}
