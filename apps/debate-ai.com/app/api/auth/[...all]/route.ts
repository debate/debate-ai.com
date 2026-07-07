import { getAuth } from "@/lib/auth";
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

export async function GET(request: Request) {
  const { GET: handler } = await getHandlers();
  return handler(request);
}

export async function POST(request: Request) {
  const { POST: handler } = await getHandlers();
  return handler(request);
}
