import grab from "grab-url"

/**
 * Derived (rather than imported as a named type) because grab-url's published
 * .d.ts re-exports its option types through an extensionless relative
 * specifier that Node's ESM resolver — and TypeScript's "nodenext" module
 * resolution, used to build this package — can't follow; grab's own default
 * export resolves fine, so its call signature is used to recover the type.
 */
export type GrabOptions = NonNullable<Parameters<typeof grab>[1]>

/** Default Debate AI API origin used when a client isn't given its own baseUrl. */
export const DEFAULT_BASE_URL = "https://debate-ai.com/api"

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

export interface ClientConfig {
  /** Origin + path prefix every request is resolved against. */
  baseUrl?: string
  /** Headers merged into every request (per-request headers win on conflict). */
  headers?: Record<string, string>
  /** Grab options applied to every request (cache, retryAttempts, rateLimit, etc). */
  grab?: Partial<GrabOptions>
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
 * (via `grab.mock`) all apply per the grab-url defaults passed in `config.grab`.
 */
export function createClient(config: ClientConfig = {}): Client {
  let _config: ClientConfig = { baseUrl: DEFAULT_BASE_URL, ...config }

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
      ..._config.grab,
      ...options.grab,
    })

    if (res.error) return { error: res.error }
    return { data: res.data as TResponse }
  }

  return { getConfig, setConfig, request }
}

/** Shared default client, pointed at https://debate-ai.com/api. Call `setConfig` to point it elsewhere (e.g. a staging origin, or a local dev server). */
export const client: Client = createClient()
