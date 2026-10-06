"use client"

import { useEffect, useState } from "react"
import { HardDrive } from "lucide-react"
import {
  getBulkStorageStatus,
  hydrateBulkStorage,
  subscribeBulkStorage,
  type BulkStorageStatus,
} from "@debate/data-sync/src/state/bulk-storage"
import { EXTENSION_ID } from "../../lib/config/site"

const EXTENSION_STORE_URL = `https://chromewebstore.google.com/detail/${EXTENSION_ID}`

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ["KB", "MB", "GB", "TB"]
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`
}

/**
 * Settings → "Storage on this device": explains where Debate AI keeps data
 * and shows this browser's current state.
 *
 * Signed-in data is saved to the account; the browser keeps only an offline
 * copy, in IndexedDB rather than the ~5 MB `localStorage` (which holds small
 * preferences only). With the browser extension installed, that copy is also
 * mirrored into the extension's storage, which its `unlimitedStorage`
 * permission frees from any quota — see `@debate/data-sync`'s
 * `state/bulk-storage.ts` and the extension's `src/storage/bulk-storage-bridge.ts`.
 */
export function DeviceStorageSettings() {
  const [status, setStatus] = useState<BulkStorageStatus | null>(null)

  useEffect(() => {
    let cancelled = false
    const refresh = () =>
      void getBulkStorageStatus().then((next) => {
        if (!cancelled) setStatus(next)
      })
    const unsubscribe = subscribeBulkStorage(refresh)
    void hydrateBulkStorage().then(refresh)
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  const unlimited = status?.insideExtension || status?.extensionConnected

  return (
    <section
      aria-labelledby="device-storage-heading"
      className="max-w-5xl mx-auto px-4 sm:px-6 mb-4"
    >
      <div className="rounded-lg border border-border bg-background p-4">
        <h2 id="device-storage-heading" className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <HardDrive className="h-4 w-4" aria-hidden="true" />
          Storage on this device
        </h2>
        <div className="mt-2 space-y-2 text-sm text-muted-foreground">
          <p>
            When you are signed in, your flows, rounds, cards and settings are saved to your account, so they follow
            you to any device. Debate AI also keeps an offline copy in this browser so you can keep working without a
            connection.
          </p>
          <p>
            That copy lives in the browser&apos;s database (IndexedDB), not in <code>localStorage</code>, which only
            holds small preferences — so you will not see &ldquo;storage full&rdquo; warnings, and nothing is deleted
            to make room.
          </p>
          <p>
            For unlimited offline storage, install the{" "}
            <a href={EXTENSION_STORE_URL} target="_blank" rel="noreferrer" className="underline text-foreground">
              Debate AI browser extension
            </a>
            . It asks for the <strong>unlimited storage</strong> permission, and this site then mirrors its offline
            copy into the extension, where no browser quota applies.
          </p>
        </div>

        {status && (
          <dl className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Offline copy:</dt>
              <dd className="text-foreground">
                {status.backend === "indexeddb" ? "Browser database (IndexedDB)" : "This session only"}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Browser extension:</dt>
              <dd className="text-foreground">
                {status.insideExtension
                  ? "Running inside the extension — unlimited"
                  : status.extensionConnected
                    ? "Connected — unlimited storage"
                    : "Not connected"}
              </dd>
            </div>
            {!unlimited && status.usage !== null && status.quota !== null && (
              <div className="flex gap-2">
                <dt className="text-muted-foreground">Used:</dt>
                <dd className="text-foreground">
                  {formatBytes(status.usage)} of {formatBytes(status.quota)} available to this site
                </dd>
              </div>
            )}
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Protected from cleanup:</dt>
              <dd className="text-foreground">{status.persisted || unlimited ? "Yes" : "No"}</dd>
            </div>
          </dl>
        )}
      </div>
    </section>
  )
}
