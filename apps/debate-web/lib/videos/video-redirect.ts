/**
 * @fileoverview Where a request for a video's page is sent when it did not
 * ask for the video's current address.
 *
 * Every shape a round has had resolves to the same video
 * (`resolveVideoRoute`), so the page answers all but the current one with a
 * permanent redirect: the `/videos/<season>/<format>/…` form a round had
 * before topic codes, an uppercased or retagged one, the speech and view as
 * `?speech=2ar&tab=outcomes`. One address per video keeps search engines and
 * shared links on one URL.
 *
 * @module lib/videos/video-redirect
 */

import {
  SPEECH_PARAM,
  SPEECH_VIEW_PARAM,
  parseSpeechRouteSuffix,
  speechRouteSuffix,
  videoRouteHref,
  type VideoType,
} from "@debate-ai/videos";

/** A page's query string, as Next.js hands it over. */
type Query = Record<string, string | string[] | undefined>;

/** The first value of a query parameter. */
function firstParam(value: string | string[] | undefined): string | null {
  return (Array.isArray(value) ? value[0] : value) ?? null;
}

/**
 * The address to redirect to, or `null` when the request already is the
 * video's current address.
 *
 * @param video - The video the request resolved to.
 * @param suffix - The segments after its address: the open speech and view.
 * @param query - The request's query string.
 * @param requestedPath - The path as requested, speech and view included.
 * @returns e.g. `/cpd27/shirley/octofinals/kansas-ss-harvard-ab/1nc/llm?x=1`,
 *   the speech and view moved into the path and other parameters kept.
 */
export function videoRedirectTarget(
  video: VideoType,
  suffix: readonly string[],
  query: Query,
  requestedPath: string,
): string | null {
  const fromPath = parseSpeechRouteSuffix([...suffix]);
  const speech = firstParam(query[SPEECH_PARAM]) ?? fromPath?.speech;
  const tab = firstParam(query[SPEECH_VIEW_PARAM]) ?? fromPath?.tab;
  const canonical = `${videoRouteHref(video)}${speechRouteSuffix(speech, tab)}`;
  const hasLegacyQuery = SPEECH_PARAM in query || SPEECH_VIEW_PARAM in query;
  if (requestedPath === canonical && !hasLegacyQuery) return null;

  const rest = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (key === SPEECH_PARAM || key === SPEECH_VIEW_PARAM || value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) rest.append(key, item);
  }
  const search = rest.toString();
  return search ? `${canonical}?${search}` : canonical;
}
