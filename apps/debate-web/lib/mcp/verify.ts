import { getAuth } from "../auth";

/**
 * Whether an `Authorization: Bearer …` header names a live session — an API
 * key (lib/mcp/api-keys.ts) or any other session token. The bearer plugin
 * does the token → session lookup, exactly as it does for every `/api` route.
 */
export async function verifySessionAuthorization(authorization: string): Promise<boolean> {
  try {
    const auth = await getAuth();
    const session = await auth.api.getSession({ headers: new Headers({ authorization }) });
    return Boolean(session?.user?.id);
  } catch (error) {
    console.error("MCP API key check failed", error);
    return false;
  }
}
