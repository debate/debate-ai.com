/**
 * Utility functions for managing localStorage and monitoring storage quota
 */

/**
 * Estimates the size of a string in bytes (UTF-16)
 */
export function estimateSize(str: string): number {
  // Each character in JavaScript is 2 bytes (UTF-16)
  return new Blob([str]).size
}

/**
 * Gets the approximate size of all data in localStorage
 */
export function getLocalStorageSize(): { total: number; byKey: Record<string, number> } {
  let total = 0
  const byKey: Record<string, number> = {}

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key) {
      const value = localStorage.getItem(key) || ""
      const size = estimateSize(key) + estimateSize(value)
      byKey[key] = size
      total += size
    }
  }

  return { total, byKey }
}

/**
 * Formats bytes to human-readable format
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes"

  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

/**
 * Gets storage usage information
 */
export function getStorageInfo() {
  const { total, byKey } = getLocalStorageSize()
  const ESTIMATED_QUOTA = 10 * 1024 * 1024 // 10 MB (typical browser limit)
  const percentUsed = (total / ESTIMATED_QUOTA) * 100

  return {
    totalBytes: total,
    totalFormatted: formatBytes(total),
    estimatedQuota: ESTIMATED_QUOTA,
    percentUsed: Math.min(percentUsed, 100),
    byKey,
    isNearLimit: percentUsed > 80,
    isCritical: percentUsed > 90,
  }
}

/**
 * Logs detailed storage information to console
 */
export function logStorageInfo() {
  const info = getStorageInfo()

  console.log("=== LocalStorage Usage ===")
  console.log(`Total: ${info.totalFormatted} / ${formatBytes(info.estimatedQuota)}`)
  console.log(`Usage: ${info.percentUsed.toFixed(1)}%`)

  if (info.isNearLimit) {
    console.warn("⚠️ Storage usage is high!")
  }
  if (info.isCritical) {
    console.error("🔴 Storage usage is critical!")
  }

  console.log("\nBreakdown by key:")
  const sorted = Object.entries(info.byKey).sort((a, b) => b[1] - a[1])
  sorted.forEach(([key, size]) => {
    const percent = ((size / info.totalBytes) * 100).toFixed(1)
    console.log(`  ${key}: ${formatBytes(size)} (${percent}%)`)
  })
  console.log("=======================")

  return info
}

/**
 * Safely sets an item in localStorage with quota error handling
 */
export function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value)
    return true
  } catch (e) {
    if (e instanceof DOMException && e.name === "QuotaExceededError") {
      console.error(`QuotaExceededError: Unable to save ${key}`)
      logStorageInfo()
      return false
    }
    throw e
  }
}

/**
 * Clears old speech documents to free up space
 */
export function cleanupOldSpeechDocs(flowIds: number[]): number {
  let cleaned = 0
  const validPrefixes = flowIds.map((id) => `speech-doc-${id}-`)

  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i)
    if (key && key.startsWith("speech-doc-")) {
      // Check if this speech doc belongs to a valid flow
      const isValid = validPrefixes.some((prefix) => key.startsWith(prefix))
      if (!isValid) {
        localStorage.removeItem(key)
        cleaned++
      }
    }
  }

  if (cleaned > 0) {
    console.log(`Cleaned up ${cleaned} orphaned speech documents`)
  }

  return cleaned
}
