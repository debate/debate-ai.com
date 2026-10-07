/**
 * Cloudflare Worker entry point (`main` in wrangler.jsonc).
 *
 * vinext scaffolded this file once, but it is hand-maintained source now: it
 * wires the crons, the Durable Object, the Turnstile gate, redirects and D1
 * sessions around vinext's app-router handler. vinext only generates an entry
 * when `worker/index.ts` is missing, so this file must stay committed — do not
 * gitignore it, and do not delete it to "regenerate" it. The real build output
 * (`dist/`, `.wrangler/`, `.vinext/`) is already gitignored.
 */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import type { ImageConfig } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { getDBFromContext, runWithContext } from "../lib/database/context";
import { describeError } from "../lib/database/errors";
import { applyD1Bookmark, runWithD1Session, runWithPrimaryD1Session } from "../lib/database/d1-session";
import { runWeeklyYouTubeSync } from "../lib/youtube/weekly-sync";
import { openAutoMarkets } from "../lib/predictions/auto-markets";
import { purgeOldReuseCheckLogRows } from "../lib/evidence-reuse-check/purge-reuse-check-log";
import { DB_BACKUP_CRON, runWeeklyDbBackup } from "../lib/admin/weekly-db-backup";
import { handleTurnstileGate, type TurnstileEnv } from "../lib/turnstile";
import {
  handleCanonicalHostRedirect,
  handleCategoryPathRedirect,
  handleVideoListingRedirect,
  redirectNotFound,
} from "../lib/redirects";
import { setSiteOriginReader } from "../lib/seo/site-url";
import { youtubeWatchRedirect } from "../lib/youtube/video-redirect";
import { getAuth } from "../lib/auth";
import { normalizeRoomId } from "@debate/round/src/webcam/room-protocol";
import { handleRoomSocket } from "../lib/webcam/debate-room";

// Durable Object classes must be exported from the Worker's main module.
export { DebateRoomSignal } from "../lib/webcam/debate-room";

interface Env extends TurnstileEnv {
  ASSETS: Fetcher;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
  debate_db: D1Database;
  // Content-table SQL backups (lib/admin/db-backup-r2.ts), bound in wrangler.jsonc.
  DB_BACKUPS?: unknown;
  // `.sql.7z` copies of those backups (lib/admin/db-backup-r2.ts).
  DB_BACKUPS_KV?: unknown;
  // Webcam-room signalling (lib/webcam/debate-room.ts), bound in wrangler.jsonc.
  DEBATE_ROOMS?: Parameters<typeof handleRoomSocket>[1];
  // See lib/database/d1-session.ts — "auto" (default), "primary",
  // "unconstrained" or "off". Settable as a plain Variable in the dashboard.
  D1_SESSION_MODE?: string;
  // When set, responses carry x-d1-served-by-region / -primary so you can see
  // which D1 instance answered.
  D1_SESSION_DEBUG?: string;
  BETTER_AUTH_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  AUTH_DISCORD_ID?: string;
  AUTH_DISCORD_SECRET?: string;
  AUTH_LINKEDIN_ID?: string;
  AUTH_LINKEDIN_SECRET?: string;
  RESEND_API_KEY?: string;
  NEXT_PUBLIC_BASE_URL?: string;
  // Canonical origin for SEO metadata — /sitemap.xml's `<loc>`, the
  // `robots.txt` `Sitemap:` line, and every page's `metadataBase`. Unset in
  // production, where lib/seo/site-url.ts falls back to CANONICAL_HOST. Set it
  // (full origin or bare host) to point a preview or staging deployment at its
  // own domain instead. Consulted in the order listed in
  // lib/seo/site-url.ts's SITE_ORIGIN_VARS.
  CANONICAL_SITE_URL?: string;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

interface ScheduledEvent {
  cron: string;
  scheduledTime: number;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Publish the bindings to the SEO origin lookup before anything else
    // reads it. `/sitemap.xml`, `/robots.txt` and every page's
    // `metadataBase` resolve the canonical domain through
    // `lib/seo/site-url.ts`, and this is the only place `env` is in scope
    // before `runWithContext` below publishes the request context.
    setSiteOriginReader(
      (name) => (env as unknown as Record<string, string | undefined>)[name],
    );

    // Canonical host, ahead of everything else: a request that arrived on the
    // `ebate.app` apex (or its `www.` form) is sent to `d.ebate.app` with its
    // path and query intact, before any work is done for it. Returns null for
    // every other host — `d.ebate.app`, `debate-ai.com`, previews and dev.
    // See lib/redirects/canonical-host.ts.
    const redirect = handleCanonicalHostRedirect(request);
    if (redirect) return redirect;

    // Pages moved under their sidebar category (`/cards` → `/research/cards`,
    // `/drills` → `/practice/drills`, …): an old URL gets a permanent redirect
    // to the new one, query intact. See lib/redirects/category-paths.ts.
    const moved = handleCategoryPathRedirect(request);
    if (moved) return moved;

    // `/videos/<season>` and `/videos/<season>/<tournament>` — a video's
    // address trimmed back — open the library filtered to that season and
    // tournament. See lib/redirects/video-listing.ts.
    const listing = handleVideoListingRedirect(request);
    if (listing) return listing;

    // App-owned `/youtube` links are convenience links only: send the viewer
    // to YouTube's normal watch page. Do not proxy YouTube content, user
    // credentials, or account-specific entitlements through this Worker.
    const youtubeDestination = youtubeWatchRedirect(request);
    if (youtubeDestination) return Response.redirect(youtubeDestination, 302);

    // Cloudflare Turnstile, in front of everything else: a desktop browser's
    // first HTML page view is answered with a "just a moment" check until it
    // carries a pass this Worker signed. Returns null — and costs one HMAC
    // verify — for every other request, and for all of them when the
    // TURNSTILE_* variables are unset. Runs outside the D1 scopes below
    // because a challenged request never reaches the database.
    // See lib/turnstile/gate.ts.
    const gated = await handleTurnstileGate(request, env);
    if (gated) return gated;

    // Two nested scopes for the request: `runWithContext` publishes the
    // bindings, and `runWithD1Session` pins every D1 query the request makes
    // to one read-replication session (lib/database/d1-session.ts). The
    // session's closing bookmark rides back on the response so the client's
    // next request never reads an older version of the database than this one.
    return runWithD1Session(request, env.D1_SESSION_MODE, () =>
      runWithContext(env, async () => {
        const url = new URL(request.url);

        // Webcam rooms: `/api/rooms/:roomId/ws` upgrades go to the room's
        // Durable Object. Allow signed-in users and anonymous guests.
        const roomSocket = await handleRoomSocket(
          request,
          env.DEBATE_ROOMS,
          async (req) => {
            const auth = await getAuth();
            const session = await auth.api.getSession({ headers: req.headers });
            if (session) {
              return session.user.name || session.user.email?.split("@")[0] || "Debater";
            }
            // No session: allow as "Guest" (Durable Object uses x-room-name or "Guest").
            return "Guest";
          },
          normalizeRoomId,
        );
        if (roomSocket) return roomSocket;

        // Image optimization via Cloudflare Images binding.
        if (url.pathname === "/_vinext/image") {
          const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
          return handleImageOptimization(request, {
            fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
            transformImage: async (body, { width, format, quality }) => {
              const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
              return result.response();
            },
          }, allowedWidths);
        }

        const rendered = await handler.fetch(request, env, ctx);
        // A page that does not exist sends the viewer one segment up — a bad
        // `/tournaments/…` address lands back on `/tournaments` — rather than
        // on a bare 404. See lib/redirects/not-found.ts.
        const response = redirectNotFound(request, rendered) ?? rendered;
        return applyD1Bookmark(response, { debug: Boolean(env.D1_SESSION_DEBUG) });
      }),
    );
  },

  // Weekly YouTube maintenance (see the `triggers.crons` entry in
  // wrangler.jsonc) — scans the subscribed channels for new videos and
  // refreshes every stored video's view count, so neither depends on an admin
  // remembering to press the buttons on /admin. Both passes live in
  // lib/youtube/weekly-sync.ts. The same weekly tick also purges expired
  // `reuse_check_log` rows (idea #7's retention/purge policy follow-up) — an
  // unrelated, independent job piggybacking on the one cron trigger this app
  // has, rather than a dedicated schedule of its own.
  //
  // A second cron (DB_BACKUP_CRON, Sundays) runs only the weekly content
  // backup to R2 — see lib/admin/weekly-db-backup.ts.
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    // The jobs below never render a page, so nothing here needs the canonical
    // origin today — but a cron that logs a URL, or one that grows into sending
    // a notification, would otherwise silently fall back to the production
    // default. Publishing the bindings costs one call and keeps that impossible.
    setSiteOriginReader(
      (name) => (env as unknown as Record<string, string | undefined>)[name],
    );

    if (event.cron === DB_BACKUP_CRON) {
      ctx.waitUntil(
        runWithPrimaryD1Session(() => runWithContext(env, () => runWeeklyDbBackup())).catch((error) => {
          console.error("Scheduled DB backup failed:", describeError(error), error);
        }),
      );
      return;
    }

    // Both jobs write, and neither has a client bookmark to resume from, so
    // each runs in its own session started on the primary.
    ctx.waitUntil(
      // `runWeeklyYouTubeSync` reports a failed pass rather than throwing, so
      // this catch is only for something breaking outside the two passes.
      runWithPrimaryD1Session(() => runWithContext(env, () => runWeeklyYouTubeSync())).catch((error) => {
        console.error("Scheduled YouTube sync failed:", describeError(error), error);
      }),
    );
    ctx.waitUntil(
      runWithPrimaryD1Session(() => runWithContext(env, () => purgeOldReuseCheckLogRows())).catch((error) => {
        console.error("Scheduled reuse-check log purge failed:", describeError(error), error);
      }),
    );
    ctx.waitUntil(
      runWithPrimaryD1Session(() =>
        runWithContext(env, async () => openAutoMarkets(await getDBFromContext())),
      ).catch((error) => {
        console.error("Scheduled auto-markets failed:", describeError(error), error);
      }),
    );
  },
};
