/**
 * @fileoverview Keeps the Moonshine speech-to-text model (the round
 * recording's "Transcribe captions with Moonshine" option) in this browser's
 * Cache Storage, so it downloads once and Settings can download it ahead of
 * time, show its size and remove it.
 *
 * `@moonshine-ai/moonshine-js` has no cache of its own: ONNX Runtime fetches
 * the two model files from Moonshine's CDN on every load. `withMoonshineCache`
 * runs a load with `fetch` answering those two URLs from the cache (storing
 * them on a miss), and passes every other request straight through.
 *
 * @module recorder/moonshine-model-cache
 */

/** The model the round recording transcribes with (a path under Moonshine's CDN). */
export const MOONSHINE_MODEL_PATH = "model/base"

/** The files `MoonshineModel` loads for `MOONSHINE_MODEL_PATH` at its default (quantized) precision. */
export const MOONSHINE_MODEL_FILES: readonly string[] = ["encoder_model.onnx", "decoder_model_merged.onnx"].map(
  (file) => `https://download.moonshine.ai/${MOONSHINE_MODEL_PATH}/quantized/${file}`,
)

/** The Cache Storage bucket the files are kept in. */
export const MOONSHINE_CACHE_NAME = "debate-ai-models"

/** What the two files weigh together (20.5 MB + 42.5 MB), for Settings before they're cached. */
export const MOONSHINE_DOWNLOAD_BYTES = 63_011_933

export interface MoonshineModelStatus {
  downloaded: boolean
  bytes: number
}

function cacheAvailable(): boolean {
  return typeof caches !== "undefined"
}

/** Whether both files are cached, and how many bytes they take. */
export async function moonshineModelStatus(): Promise<MoonshineModelStatus> {
  if (!cacheAvailable() || !(await caches.has(MOONSHINE_CACHE_NAME))) return { downloaded: false, bytes: 0 }
  const cache = await caches.open(MOONSHINE_CACHE_NAME)
  let bytes = 0
  let found = 0
  for (const url of MOONSHINE_MODEL_FILES) {
    const response = await cache.match(url)
    if (!response) continue
    found += 1
    const length = Number(response.headers.get("content-length"))
    bytes += Number.isFinite(length) && length > 0 ? length : (await response.blob()).size
  }
  return { downloaded: found === MOONSHINE_MODEL_FILES.length, bytes }
}

/**
 * Downloads the files not cached yet into the cache, reporting progress
 * from 0 to 1 across both.
 */
export async function downloadMoonshineModel(
  onProgress?: (fraction: number) => void,
  fetchImpl: typeof fetch = (input, init) => fetch(input, init),
): Promise<void> {
  if (!cacheAvailable()) throw new Error("This browser has no Cache Storage")
  const cache = await caches.open(MOONSHINE_CACHE_NAME)
  const missing: string[] = []
  for (const url of MOONSHINE_MODEL_FILES) if (!(await cache.match(url))) missing.push(url)
  const loaded = new Map<string, number>()
  const totals = new Map<string, number>()
  const report = () => {
    const total = [...totals.values()].reduce((a, b) => a + b, 0) || MOONSHINE_DOWNLOAD_BYTES
    const done = [...loaded.values()].reduce((a, b) => a + b, 0)
    onProgress?.(Math.min(1, done / total))
  }
  await Promise.all(
    missing.map(async (url) => {
      const response = await fetchImpl(url)
      if (!response.ok || !response.body) throw new Error(`Moonshine download failed (${response.status})`)
      totals.set(url, Number(response.headers.get("content-length")) || 0)
      const reader = response.body.getReader()
      const chunks: Uint8Array[] = []
      let size = 0
      for (let next = await reader.read(); !next.done; next = await reader.read()) {
        chunks.push(next.value)
        size += next.value.byteLength
        loaded.set(url, size)
        report()
      }
      const blob = new Blob(chunks as BlobPart[], { type: "application/octet-stream" })
      await cache.put(url, new Response(blob, { headers: { "content-length": String(blob.size) } }))
    }),
  )
  onProgress?.(1)
}

/** Deletes the cached files; the next Moonshine transcription downloads them again. */
export async function removeMoonshineModel(): Promise<void> {
  if (!cacheAvailable() || !(await caches.has(MOONSHINE_CACHE_NAME))) return
  const cache = await caches.open(MOONSHINE_CACHE_NAME)
  await Promise.all(MOONSHINE_MODEL_FILES.map((url) => cache.delete(url)))
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input
  if (input instanceof URL) return input.href
  return input.url
}

/**
 * Runs `load` (a `MoonshineModel.loadModel()`) with the model files served
 * from the cache, and cached on the way through when they aren't yet.
 * Without Cache Storage it just runs `load`.
 */
export async function withMoonshineCache<T>(load: () => Promise<T>): Promise<T> {
  if (!cacheAvailable()) return load()
  const original = globalThis.fetch
  const cached: typeof fetch = async (input, init) => {
    const url = requestUrl(input)
    if (!MOONSHINE_MODEL_FILES.includes(url)) return original(input, init)
    const cache = await caches.open(MOONSHINE_CACHE_NAME).catch(() => null)
    const hit = await cache?.match(url)
    if (hit) return hit
    const response = await original(input, init)
    if (response.ok && cache) void cache.put(url, response.clone()).catch(() => {})
    return response
  }
  globalThis.fetch = cached
  try {
    return await load()
  } finally {
    if (globalThis.fetch === cached) globalThis.fetch = original
  }
}
