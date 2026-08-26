import { errorMessage } from "./errorMessage";
import { isDesktop } from "./update/adapter";

/**
 * Send a link to the system browser.
 *
 * `target="_blank"` does nothing inside a Tauri webview: there is no window for
 * it to open into and the navigation is simply dropped, so a link that works in
 * `npm run dev` silently does nothing in the shipped app. On the desktop the
 * opener plugin hands the URL to the real browser; in a browser the anchor's
 * own behavior is left alone.
 *
 * The permitted URLs are pinned in `src-tauri/capabilities/default.json`, so
 * this cannot become a way to open anything the app did not ship with. A URL
 * outside that list rejects, and the rejection is reported rather than dropped:
 * the scope is matched by glob against the raw string, which makes it easy to
 * write an entry that looks right and never matches.
 */
export function openExternal(event: { preventDefault(): void }, href: string): void {
    if (!isDesktop()) return;
    event.preventDefault();
    // Platform-only module: the browser bundle must not pull in Tauri's plugin.
    void import("@tauri-apps/plugin-opener")
        .then(({ openUrl }) => openUrl(href))
        .catch(async (err: unknown) => {
            const { toast } = await import("sonner");
            toast.error(errorMessage(err, `Could not open ${href}`));
        });
}
