import { NextResponse } from "next/server";

/**
 * GET /youtube-player?vid=<id>[&autoplay=1][&start=<s>][&controls=0]
 *
 * A bare page that hosts the YouTube iframe on this site's own https origin.
 * YouTube answers error 153 to an embed it can't attribute, which is what an
 * iframe in the document Picture-in-Picture window (about:blank, no Referer)
 * and one on the browser extension's chrome-extension:// pages both are. Those
 * players load this route instead (see `playerRouteUrl` in
 * packages/debate-videos/src/components/videos/player/youtubeEmbed.ts); it
 * relays the IFrame API messages between the framing page and YouTube.
 *
 * The embed's `origin` is always this page's own: YouTube posts its events
 * to that origin, so an extension origin there would make them undeliverable.
 * `/youtube-player.html` is rewritten here (next.config.mjs) for older links.
 */

const HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="frame-ancestors 'self' chrome-extension://* moz-extension://*;">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>YouTube Player</title>
  <style>
    html, body {
      margin: 0;
      width: 100%;
      height: 100%;
      background: #000;
    }
    iframe {
      display: block;
      width: 100%;
      height: 100%;
      border: 0;
    }
    .error {
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
        'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
        sans-serif;
      padding: 1rem;
      text-align: center;
    }
  </style>
</head>
<body>
  <script>
    const params = new URLSearchParams(location.search);
    const id = params.get("vid");
    const origin = location.origin;

    if (/^[A-Za-z0-9_-]{11}$/.test(id ?? "")) {
      const player = document.createElement("iframe");
      const embedParams = new URLSearchParams({
        enablejsapi: "1",
        rel: "0",
        controls: params.get("controls") === "0" ? "0" : "1",
      });
      if (params.get("autoplay") === "1") embedParams.set("autoplay", "1");
      const start = params.get("start");
      if (start && /^\d+$/.test(start)) embedParams.set("start", start);
      embedParams.set("origin", origin);
      embedParams.set("widget_referrer", origin);
      player.src = \`https://www.youtube.com/embed/\${id}?\${embedParams.toString()}\`;
      player.referrerPolicy = "strict-origin-when-cross-origin";
      player.allow =
        "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen";
      player.allowFullscreen = true;
      document.body.append(player);

      // Relay the IFrame API both ways: YouTube's events up to the page that
      // framed this wrapper (the app's PiP window, or the extension), and that
      // page's handshake and commands down to YouTube.
      window.addEventListener("message", (event) => {
        if (event.source === window.parent && event.source !== window) {
          player.contentWindow?.postMessage(event.data, "https://www.youtube.com");
          return;
        }
        if (event.origin !== "https://www.youtube.com") return;
        try {
          if (window.parent && window.parent !== window) {
            window.parent.postMessage(event.data, "*");
          }
        } catch (e) {
          // ignore
        }
      });
    } else {
      const err = document.createElement("div");
      err.className = "error";
      err.textContent = "Invalid YouTube video ID.";
      document.body.append(err);
    }
  </script>
</body>
</html>`;

export async function GET() {
  return new NextResponse(HTML, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": "frame-ancestors 'self' chrome-extension://* moz-extension://*;",
      "Cache-Control": "public, max-age=3600, immutable",
    },
  });
}