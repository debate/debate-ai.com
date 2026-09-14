import { NextResponse } from "next/server";

import {
  VISITOR_LOCATION_MAX_AGE_SECONDS,
  readVisitorLocation,
} from "@/lib/location";

/**
 * The visitor's coarse, city-level location.
 *
 * The HTTP shell only: where the answer comes from — Cloudflare's own
 * `request.cf` and `cf-*` headers, never a third-party IP API — is in
 * `lib/location/visitor-location`.
 *
 * `private` because the body describes one visitor and must not be held in a
 * shared cache; the long `max-age` matches the browser-side cache in
 * `lib/location/client`, so a returning visitor re-uses the answer instead of
 * asking again on every page view.
 */
export async function GET(request: Request) {
  return NextResponse.json(readVisitorLocation(request), {
    headers: {
      "Cache-Control": `private, max-age=${VISITOR_LOCATION_MAX_AGE_SECONDS}`,
    },
  });
}
