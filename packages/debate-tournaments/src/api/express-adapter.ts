/**
 * Runs upstream's Express routers on a fetch `Request`, producing a fetch
 * `Response` — the piece that lets the vendored `/rest` and `/pages` routers
 * serve from a Cloudflare Worker (or a Next/vinext route handler) unchanged.
 *
 * Express's router is the standalone `router` package, which only needs a
 * request with `method`/`url` and a callback; the request and response
 * objects here implement the subset of Express's API the vendored controllers
 * and middleware use (`req.params/query/body/headers/get`,
 * `res.status/json/send/type/set/end/redirect/sendStatus`).
 */

export interface ExpressLikeRouter {
  (req: any, res: any, done: (err?: unknown) => void): void;
}

export interface AdaptOptions {
  /** Path the router sees, e.g. `/rest/tourns/12` (query string excluded). */
  path: string;
  /** Extra request properties, e.g. `actor` and `session`. */
  locals?: Record<string, unknown>;
}

function parseQuery(params: URLSearchParams): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const key of new Set(params.keys())) {
    const all = params.getAll(key);
    out[key] = all.length > 1 ? all : all[0];
  }
  return out;
}

async function readBody(request: Request): Promise<unknown> {
  if (request.method === "GET" || request.method === "HEAD") return undefined;
  const text = await request.text();
  if (!text) return undefined;
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("json")) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  if (type.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(text));
  }
  return text;
}

function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? "").split(";")) {
    const eq = part.indexOf("=");
    if (eq > 0) out[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim());
  }
  return out;
}

const problem = (status: number, title: string, detail: string, instance: string) =>
  new Response(JSON.stringify({ type: "about:blank", title, status, detail, instance }), {
    status,
    headers: { "content-type": "application/problem+json" },
  });

/** Dispatches `request` through `router` and resolves with the response it writes. */
export async function runExpressRouter(
  router: ExpressLikeRouter,
  request: Request,
  { path, locals = {} }: AdaptOptions,
): Promise<Response> {
  const url = new URL(request.url);
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  const body = await readBody(request);
  const routedUrl = `${path}${url.search}`;

  return new Promise<Response>((resolve) => {
    let settled = false;
    const finish = (response: Response) => {
      if (!settled) {
        settled = true;
        resolve(response);
      }
    };

    const responseHeaders = new Headers();
    const listeners: Record<string, Array<() => void>> = {};

    const res: Record<string, any> = {
      statusCode: 200,
      locals: {},
      headersSent: false,
      status(code: number) {
        res.statusCode = code;
        return res;
      },
      set(field: string | Record<string, string>, value?: string) {
        if (typeof field === "object") {
          for (const [k, v] of Object.entries(field)) responseHeaders.set(k, String(v));
        } else if (value !== undefined) {
          responseHeaders.set(field, String(value));
        }
        return res;
      },
      header(field: string, value: string) {
        return res.set(field, value);
      },
      setHeader(field: string, value: string) {
        responseHeaders.set(field, String(value));
        return res;
      },
      get(field: string) {
        return responseHeaders.get(field) ?? undefined;
      },
      getHeader(field: string) {
        return responseHeaders.get(field) ?? undefined;
      },
      type(contentType: string) {
        responseHeaders.set("content-type", contentType.includes("/") ? contentType : `application/${contentType}`);
        return res;
      },
      json(payload: unknown) {
        if (!responseHeaders.has("content-type")) responseHeaders.set("content-type", "application/json");
        return res.end(JSON.stringify(payload ?? null));
      },
      send(payload?: unknown) {
        if (payload !== null && typeof payload === "object" && !(payload instanceof Uint8Array)) {
          return res.json(payload);
        }
        if (typeof payload === "number") {
          res.statusCode = payload;
          return res.end();
        }
        if (typeof payload === "string" && !responseHeaders.has("content-type")) {
          responseHeaders.set("content-type", "text/html; charset=utf-8");
        }
        return res.end(payload as BodyInit | undefined);
      },
      sendStatus(code: number) {
        res.statusCode = code;
        return res.end(String(code));
      },
      redirect(statusOrUrl: number | string, maybeUrl?: string) {
        const status = typeof statusOrUrl === "number" ? statusOrUrl : 302;
        const location = typeof statusOrUrl === "string" ? statusOrUrl : String(maybeUrl);
        responseHeaders.set("location", location);
        res.statusCode = status;
        return res.end();
      },
      end(payload?: BodyInit) {
        res.headersSent = true;
        const noBody = res.statusCode === 204 || res.statusCode === 304 || request.method === "HEAD";
        finish(new Response(noBody ? null : (payload ?? null), { status: res.statusCode, headers: responseHeaders }));
        (listeners.finish ?? []).forEach((fn) => fn());
        return res;
      },
      on(event: string, fn: () => void) {
        (listeners[event] ??= []).push(fn);
        return res;
      },
      once(event: string, fn: () => void) {
        return res.on(event, fn);
      },
    };

    const req: Record<string, any> = {
      method: request.method,
      url: routedUrl,
      originalUrl: routedUrl,
      baseUrl: "",
      path,
      headers,
      query: parseQuery(url.searchParams),
      params: {},
      body,
      cookies: parseCookies(request.headers.get("cookie")),
      ip: headers["cf-connecting-ip"] ?? headers["x-forwarded-for"]?.split(",")[0]?.trim() ?? "",
      protocol: url.protocol.replace(":", ""),
      hostname: url.hostname,
      get(name: string) {
        return headers[name.toLowerCase()];
      },
      header(name: string) {
        return headers[name.toLowerCase()];
      },
      res,
      ...locals,
    };
    res.req = req;

    const done = (err?: unknown) => {
      if (err) {
        console.error("[tabroom] unhandled route error", err);
        finish(problem(500, "Internal Server Error", "Unexpected error handling the request", routedUrl));
      } else {
        finish(problem(404, "Not Found", `No route for ${request.method} ${path}`, routedUrl));
      }
    };

    try {
      router(req, res, done);
    } catch (err) {
      done(err ?? new Error("route threw"));
    }
  });
}
