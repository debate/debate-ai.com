import { getAuth, getAuthForRequest } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

// Lazy initialization - auth is created on first request
let handlers: ReturnType<typeof toNextJsHandler> | null = null;

async function getHandlers() {
  if (!handlers) {
    const auth = await getAuth();
    handlers = toNextJsHandler(auth);
  }
  return handlers;
}

/**
 * Passkey ceremonies need a relying party that matches the page's own host,
 * so they go through the instance built for the request's origin
 * (lib/auth/security-plugins.ts); everything else shares one instance.
 */
function isPasskeyCeremony(request: Request) {
  return new URL(request.url).pathname.startsWith("/api/auth/passkey/");
}

async function handlersFor(request: Request) {
  if (!isPasskeyCeremony(request)) return getHandlers();
  return toNextJsHandler(await getAuthForRequest(request));
}

export async function GET(request: Request) {
  const { GET: handler } = await handlersFor(request);
  return handler(request);
}

export async function POST(request: Request) {
  const { POST: handler } = await handlersFor(request);
  return handler(request);
}
