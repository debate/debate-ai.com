/**
 * Routes an app-owned YouTube link to YouTube's normal watch page.
 *
 * This intentionally redirects rather than proxying video bytes, forwarding
 * account credentials, or altering YouTube responses. Playback and any
 * account-specific entitlement therefore remain between the viewer and
 * YouTube.
 */

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const FORWARDED_PARAMETERS = ["t", "start", "end", "list", "index", "si"] as const;

function videoIdFromPath(url: URL): string | null {
  const match = /^\/youtube\/([A-Za-z0-9_-]+)\/?$/.exec(url.pathname);
  return match?.[1] ?? null;
}

/**
 * Returns a direct, validated YouTube watch URL for app-owned `/youtube`
 * routes, or `null` for every other request.
 */
export function youtubeWatchRedirect(request: Request): URL | null {
  if (request.method !== "GET" && request.method !== "HEAD") return null;

  const url = new URL(request.url);
  const isQueryRoute = url.pathname === "/youtube" || url.pathname === "/youtube/watch";
  const videoId = isQueryRoute ? url.searchParams.get("v") : videoIdFromPath(url);

  if (!videoId || !VIDEO_ID_PATTERN.test(videoId)) return null;

  const destination = new URL("https://www.youtube.com/watch");
  destination.searchParams.set("v", videoId);
  for (const parameter of FORWARDED_PARAMETERS) {
    const value = url.searchParams.get(parameter);
    if (value) destination.searchParams.set(parameter, value);
  }

  return destination;
}
