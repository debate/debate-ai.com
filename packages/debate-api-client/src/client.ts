// The slim build: the same `grab()`, minus the bundled `linkedom` and
// `archiver-web` HTML/archive extractors this SDK never asks for. An OpenAPI
// response is JSON, so the full build's payload would be dead weight in every
// browser bundle that imports this package.
import grab, * as grabSlim from "grab-url/slim"

/**
 * Derived (rather than imported as a named type) because grab-url's published
 * .d.ts re-exports its option types through an extensionless relative
 * specifier that Node's ESM resolver — and TypeScript's "nodenext" module
 * resolution, used to build this package — can't follow; grab's own default
 * export resolves fine, so its call signature is used to recover the type.
 */
export type GrabOptions = NonNullable<Parameters<typeof grab>[1]>

/**
 * Reached through the namespace for the same reason: the named exports of the
 * published .d.ts are invisible under "nodenext", though they are there at
 * runtime. Optional so an older grab-url without it degrades to a no-op.
 */
const slim = grabSlim as unknown as { setupDevTools?: () => void }

/**
 * grab options every client starts with, so an SDK call gets grab's retries
 * and timeout without being configured. Override any of them client-wide with
 * `createClient({ grab })` / `setConfig({ grab })`, or per call with
 * `{ grab }` on the operation.
 *
 * {@link SAFE_METHOD_ONLY} names the ones that reach a read and nothing else —
 * serving a POST from cache, or replaying a DELETE that failed, would change
 * what the API was asked to do.
 */
export const DEFAULT_GRAB_OPTIONS = {
  /**
   * Caching is configured but left off: an SDK that served a GET from a
   * minute-old cache would hand back pre-write data after a POST to the same
   * resource, which is not a default anyone can opt out of after the fact.
   * Turn it on with `grab: { cache: true }` — the window below is already set.
   */
  cache: false,
  /** Seconds a cached response stays fresh, once `cache` is on. */
  cacheForTime: 60,
  /** Retries for a read that failed. */
  retryAttempts: 2,
  /** Seconds before a request is aborted. */
  timeout: 30,
} as const

/** Methods whose answer may be cached and whose failure may be replayed. */
const SAFE_METHODS = new Set<HttpMethod>(["GET"])

/** Options that are only ever applied to a {@link SAFE_METHODS} request. */
const SAFE_METHOD_ONLY = ["cache", "cacheForTime", "retryAttempts"] as const

/**
 * `options` as it applies to `method`: unchanged for a read, and without the
 * cache/retry entries for anything else.
 *
 * Applied to the defaults and to the client-wide `grab` alike, so turning
 * caching on for a client turns it on for its reads rather than for every
 * write it will ever send. A per-call `{ grab }` is left as written — the
 * caller is looking straight at the request they are changing.
 */
function forMethod(
  options: Partial<GrabOptions> | undefined,
  method: HttpMethod,
): Partial<GrabOptions> {
  if (!options) return {}
  if (SAFE_METHODS.has(method)) return { ...options }

  const scoped: Record<string, unknown> = { ...options }
  for (const key of SAFE_METHOD_ONLY) delete scoped[key]
  return scoped as Partial<GrabOptions>
}

/**
 * Attaches grab's Ctrl+Alt+I request inspector — a modal listing every request
 * this SDK made, with its parsed response — and makes sure the log it reads is
 * the one this SDK writes to.
 *
 * grab keeps that log on the *global* grab (`window.grab.log`) rather than on
 * the instance a caller holds, so an SDK bundled without anything else
 * importing grab has to publish one; otherwise nothing is ever recorded and
 * the modal opens empty.
 *
 * @returns Whether the inspector is now listening (false outside a browser).
 */
export function attachDevTools(): boolean {
  const scope = globalThis as unknown as Record<string, any>

  // No DOM, no keyboard shortcut: this SDK runs server-side too.
  if (typeof scope.document === "undefined") return false

  // grab-url's browser entry publishes itself on load and installs the
  // shortcut as it goes, so finding our own grab there means it is already
  // listening — registering again would list every request twice.
  const attachedOnImport = scope.grab === grab
  if (!scope.grab?.log) scope.grab = grab
  if (attachedOnImport || scope.__grabDevToolsAttached) return true

  scope.__grabDevToolsAttached = true
  slim.setupDevTools?.()
  return true
}

/** Default Debate AI API origin used when a client isn't given its own baseUrl. */
export const DEFAULT_BASE_URL = "https://debate-ai.com/api"

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

export interface ClientConfig {
  /** Origin + path prefix every request is resolved against. */
  baseUrl?: string
  /** Headers merged into every request (per-request headers win on conflict). */
  headers?: Record<string, string>
  /**
   * Grab options applied to every request, over {@link DEFAULT_GRAB_OPTIONS}.
   * {@link SAFE_METHOD_ONLY} entries here reach reads only; a write asks for
   * them with its own `{ grab }`.
   */
  grab?: Partial<GrabOptions>
  /**
   * default=true Attach grab's Ctrl+Alt+I request inspector. Set false to
   * leave the keyboard shortcut and the global `window.grab` alone.
   */
  devtools?: boolean
}

export interface RequestOptions<TBody = unknown> {
  /** OpenAPI-style path, e.g. "/coach-materials/{materialId}". */
  url: string
  method?: HttpMethod
  /** Values substituted into "{name}" segments of `url`. */
  path?: Record<string, string | number | boolean | undefined>
  /** Serialized onto the URL for GET/DELETE requests. */
  query?: Record<string, unknown>
  /** JSON-serialized as the request body for POST/PUT/PATCH requests. */
  body?: TBody
  headers?: Record<string, string>
  /** Per-request override/extension of the client's grab defaults. */
  grab?: Partial<GrabOptions>
}

export interface RequestResult<TResponse = unknown> {
  data?: TResponse
  error?: string
}

const PATH_PARAM_RE = /\{([^{}]+)\}/g

function resolvePath(url: string, params?: RequestOptions["path"]): string {
  if (!params) return url
  return url.replace(PATH_PARAM_RE, (match, name) => {
    const value = params[name]
    return value === undefined ? match : encodeURIComponent(String(value))
  })
}

function toQueryString(query?: Record<string, unknown>): string {
  if (!query) return ""
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue
    if (Array.isArray(value)) {
      for (const item of value) search.append(key, String(item))
    } else {
      search.append(key, String(value))
    }
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ""
}

export interface Client {
  getConfig: () => ClientConfig
  setConfig: (config: ClientConfig) => ClientConfig
  request: <TResponse = unknown, TBody = unknown>(
    options: RequestOptions<TBody>,
  ) => Promise<RequestResult<TResponse>>
}

/**
 * Creates a client that sends every SDK call through grab() instead of raw
 * fetch/axios, so caching, retries, rate limiting, request dedupe, and mocks
 * (via `grab.mock`) all apply — starting from {@link DEFAULT_GRAB_OPTIONS},
 * which `config.grab` overrides.
 *
 * In a browser it also attaches grab's Ctrl+Alt+I request inspector, unless
 * `config.devtools` is false.
 */
export function createClient(config: ClientConfig = {}): Client {
  let _config: ClientConfig = { baseUrl: DEFAULT_BASE_URL, ...config }

  if (_config.devtools !== false) attachDevTools()

  const getConfig = (): ClientConfig => ({ ..._config })

  const setConfig = (next: ClientConfig): ClientConfig => {
    _config = { ..._config, ...next, headers: { ..._config.headers, ...next.headers } }
    return getConfig()
  }

  const request = async <TResponse = unknown, TBody = unknown>(
    options: RequestOptions<TBody>,
  ): Promise<RequestResult<TResponse>> => {
    const method = options.method ?? "GET"
    const path = resolvePath(options.url, options.path)
    const isBodyMethod = method === "POST" || method === "PUT" || method === "PATCH"
    const url = isBodyMethod ? path : path + toQueryString(options.query)

    const res = await grab<TResponse>(url, {
      method,
      baseURL: _config.baseUrl,
      headers: { ..._config.headers, ...options.headers },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      ...forMethod(DEFAULT_GRAB_OPTIONS, method),
      ...forMethod(_config.grab, method),
      ...options.grab,
    })

    if (res.error) return { error: res.error }
    return { data: res.data as TResponse }
  }

  return { getConfig, setConfig, request }
}

/** Shared default client, pointed at https://debate-ai.com/api. Call `setConfig` to point it elsewhere (e.g. a staging origin, or a local dev server). */
export const client: Client = createClient()
