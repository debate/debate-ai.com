"use client"

/**
 * @fileoverview Settings → Sound & speech: the speech models that run on this
 * device, each with its size, whether it's downloaded, and Download / Remove.
 *
 * - **Kokoro** (text to speech) reads cards aloud in Debate Editor
 *   (`@debate-ai/editor/kokoro`; it runs in a Web Worker and Transformers.js
 *   keeps it in Cache Storage).
 * - **Moonshine** (speech to text) transcribes round recordings' captions
 *   (`@debate-ai/timer`'s `moonshine-model-cache.ts`).
 *
 * Either downloads by itself the first time it's used; downloading here just
 * gets it out of the way ahead of a round. Remove frees the space, and the
 * next use downloads it again. Local to this browser, never synced.
 *
 * @module components/settings/sections/OnDeviceModelsSection
 */

import { useCallback, useEffect, useState } from "react"
import { Cpu } from "lucide-react"
import { Button } from "@debate-ai/ui/primitives/button"
import {
  KOKORO_DOWNLOAD_BYTES,
  downloadKokoro,
  kokoroInBrowserSupported,
  kokoroModelStatus,
  removeKokoroModel,
} from "@debate-ai/editor/kokoro"
import {
  MOONSHINE_DOWNLOAD_BYTES,
  downloadMoonshineModel,
  moonshineModelStatus,
  removeMoonshineModel,
} from "@debate-ai/timer"

interface ModelStatus {
  downloaded: boolean
  bytes: number
}

interface OnDeviceModel {
  id: string
  name: string
  use: string
  approxBytes: number
  supported: () => boolean
  status: () => Promise<ModelStatus>
  download: (onProgress: (fraction: number) => void) => Promise<void>
  remove: () => Promise<void>
}

const MODELS: readonly OnDeviceModel[] = [
  {
    id: "kokoro",
    name: "Kokoro voice",
    use: "Reads cards aloud in the card editor (Read aloud), with no server and no daily limit.",
    approxBytes: KOKORO_DOWNLOAD_BYTES,
    supported: kokoroInBrowserSupported,
    status: kokoroModelStatus,
    download: (onProgress) => downloadKokoro(onProgress),
    remove: removeKokoroModel,
  },
  {
    id: "moonshine",
    name: "Moonshine transcription",
    use: "Transcribes captions for a joined round recording on this device.",
    approxBytes: MOONSHINE_DOWNLOAD_BYTES,
    supported: () => typeof caches !== "undefined" && typeof WebAssembly === "object",
    status: moonshineModelStatus,
    download: downloadMoonshineModel,
    remove: removeMoonshineModel,
  },
]

function formatMegabytes(bytes: number): string {
  return `${Math.round(bytes / 1_000_000)} MB`
}

type RowState =
  | { kind: "checking" }
  | { kind: "unsupported" }
  | { kind: "missing" }
  | { kind: "downloading"; fraction: number }
  | { kind: "downloaded"; bytes: number }
  | { kind: "error"; message: string }

function ModelRow({ model }: { model: OnDeviceModel }) {
  const [state, setState] = useState<RowState>({ kind: "checking" })

  const refresh = useCallback(async () => {
    if (!model.supported()) {
      setState({ kind: "unsupported" })
      return
    }
    try {
      const status = await model.status()
      setState(status.downloaded ? { kind: "downloaded", bytes: status.bytes } : { kind: "missing" })
    } catch {
      setState({ kind: "missing" })
    }
  }, [model])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const download = async () => {
    setState({ kind: "downloading", fraction: 0 })
    try {
      await model.download((fraction) => setState({ kind: "downloading", fraction }))
      await refresh()
    } catch (error) {
      setState({ kind: "error", message: error instanceof Error ? error.message : String(error) })
    }
  }

  const remove = async () => {
    setState({ kind: "checking" })
    try {
      await model.remove()
    } finally {
      await refresh()
    }
  }

  const statusText =
    state.kind === "checking"
      ? "Checking…"
      : state.kind === "unsupported"
        ? "This browser can't run it"
        : state.kind === "missing"
          ? `Not downloaded · about ${formatMegabytes(model.approxBytes)}`
          : state.kind === "downloading"
            ? `Downloading… ${Math.round(state.fraction * 100)}%`
            : state.kind === "downloaded"
              ? `Downloaded · ${formatMegabytes(state.bytes || model.approxBytes)}`
              : `Download failed: ${state.message}`

  return (
    <li className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-0.5">
        <p className="font-medium text-foreground">{model.name}</p>
        <p className="text-xs text-muted-foreground">{model.use}</p>
        <p className="text-xs text-muted-foreground" aria-live="polite" data-testid={`model-status-${model.id}`}>
          {statusText}
        </p>
        {state.kind === "downloading" && (
          <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div className="h-full bg-primary transition-[width]" style={{ width: `${state.fraction * 100}%` }} />
          </div>
        )}
      </div>
      <div className="shrink-0">
        {state.kind === "downloaded" ? (
          <Button type="button" size="sm" variant="outline" onClick={() => void remove()}>
            Remove
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            onClick={() => void download()}
            disabled={state.kind === "checking" || state.kind === "unsupported" || state.kind === "downloading"}
          >
            {state.kind === "error" ? "Retry" : "Download"}
          </Button>
        )}
      </div>
    </li>
  )
}

/** The on-device models row of Settings → Sound & speech. */
export function OnDeviceModelsSection() {
  return (
    <section
      id="on-device-models"
      aria-labelledby="on-device-models-heading"
      className="mb-4 rounded-lg border border-border p-4"
    >
      <h4
        id="on-device-models-heading"
        className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground"
      >
        <Cpu className="h-4 w-4" aria-hidden="true" />
        On-device speech models
      </h4>
      <p className="mb-3 text-xs text-muted-foreground">
        Each one downloads by itself the first time you use it and stays in this browser after that. Download
        ahead of a round so it's ready, or remove one to free the space.
      </p>
      <ul className="divide-y divide-border text-sm">
        {MODELS.map((model) => (
          <ModelRow key={model.id} model={model} />
        ))}
      </ul>
    </section>
  )
}
