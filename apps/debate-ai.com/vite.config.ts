import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig, type Plugin, type Rolldown } from "vite";
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { helpDocsMdx } from "@debate/help-docs/vite";

const appDir = path.resolve(import.meta.dirname);
const require = createRequire(import.meta.url);

/**
 * react-reason-editor bundles react-player, which ships dash.js as a
 * prebuilt, already-minified chunk (`dist/dash.all.min-*.js`). That file
 * carries a top-level `export` *and* bare `exports` references, so rolldown
 * reads it as ESM and warns that `exports` resolves to a free global
 * (COMMONJS_VARIABLE_IN_ESM). dash.js guards those references at runtime and
 * the file is published output of a dependency, so there is nothing to fix
 * from here — recognise it and drop it rather than print it on every build.
 */
const isVendoredDashPlayerNoise = (log: Rolldown.RolldownLog) =>
  log.code === "COMMONJS_VARIABLE_IN_ESM" &&
  [log.id, ...(log.ids ?? []), log.message].some(
    (text) => text?.includes("react-reason-editor") && text.includes("dash.all.min"),
  );

/**
 * react-reason-editor's code blocks register every highlight.js grammar
 * (`import { all } from "lowlight"`) — about 190 languages and ~870 kB of
 * the /doc Workspace chunk, most of it grammars like Mathematica, ISBL and
 * 1C that a debate doc never contains. This swaps that one import for
 * lowlight's `common` set (~37 languages: JS/TS, Python, Java, C/C++, Go,
 * Rust, SQL, shell, JSON, Markdown, …). A block in a language outside it is
 * still shown, just auto-highlighted: tiptap's lowlight plugin falls back to
 * `highlightAuto` for a language that is not registered.
 */
function reasonEditorCommonGrammars(): Plugin {
  const allImport = /import\{([^}]*?)\ball as (\w+)([^}]*)\}from"lowlight"/;
  return {
    name: "debate:reason-editor-common-grammars",
    enforce: "pre",
    transform(code, id) {
      if (!id.includes("react-reason-editor/dist/") || !code.includes('from"lowlight"')) return null;
      const next = code.replace(allImport, 'import{$1common as $2$3}from"lowlight"');
      return next === code ? null : { code: next, map: null };
    },
  };
}

/**
 * Minifier settings for the two server environments (rsc and ssr), which make
 * up the Worker.
 *
 * workerd keeps the source text of every module in the Worker's upload in the
 * isolate's heap, whether or not a request ever imports it. V8 stores a string
 * in one byte per character only while every character fits in Latin-1; one
 * CJK word, emoji or math symbol anywhere in a module makes it two bytes per
 * character. Measured with `wrangler dev` before this: 360 of the ~1,370
 * server modules were two-byte, 78 MB of an estimated 87 MB, and the isolate
 * sat at 141 MB of heap before its first request. That is over the Workers
 * 128 MB limit, so production isolates were being thrown away and every
 * request paid a cold start (2.5 to 5.8 s, even for a redirect).
 *
 * `asciiOnly` makes the minifier write those characters as `\u` escapes, which
 * keeps each module one-byte. Tagged template text is left as written (its
 * raw form is observable), so a module can still end up two-byte through one.
 * The browser bundles keep their literal characters: over the network the
 * UTF-8 form is smaller than the escapes.
 */
const serverMinify = { compress: true, mangle: true, codegen: { asciiOnly: true } } as const;

/**
 * The site's static files (favicons, apple-touch-icon.png, site.webmanifest,
 * …) live at the top of `app/` rather than in a `public/` folder, but Vite
 * only serves `publicDir` verbatim — so anything in `app/` that is not a
 * Next metadata convention (favicon.ico is; apple-touch-icon.png is not)
 * 404'd. This serves every top-level non-source file in `app/` at the site
 * root, exactly as if it sat in `public/`: straight off disk in dev, and
 * emitted into the client build (`dist/client`, which Cloudflare serves as
 * static assets) otherwise. Source files (.ts/.tsx/.js/.css/…) are never
 * exposed — which also leaves app/service-worker.js, a stale pre-Vite build,
 * to `build:sw`. A file of the same name in `public/` still wins.
 */
const APP_SOURCE_EXT = /\.(?:[cm]?[jt]sx?|mdx?|css|scss|sass|less)$/i;
const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".webmanifest": "application/manifest+json",
  ".json": "application/json",
  ".txt": "text/plain",
  ".xml": "application/xml",
  ".yml": "text/yaml",
  ".yaml": "text/yaml",
};

function appStaticFiles(): Plugin {
  const dir = path.join(appDir, "app");
  const list = () =>
    fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && !e.name.startsWith("."))
      .map((e) => e.name)
      .filter((name) => !APP_SOURCE_EXT.test(name));
  let publicDir = "";
  const inPublic = (name: string) => !!publicDir && fs.existsSync(path.join(publicDir, name));

  return {
    name: "app-static-files",
    configResolved(config) {
      publicDir = config.publicDir;
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const name = decodeURIComponent((req.url ?? "").split("?")[0].replace(/^\//, ""));
        if (!name || name.includes("/") || inPublic(name) || !list().includes(name)) return next();
        const type = CONTENT_TYPES[path.extname(name).toLowerCase()];
        if (type) res.setHeader("Content-Type", type);
        fs.createReadStream(path.join(dir, name)).pipe(res);
      });
    },
    generateBundle() {
      if (this.environment?.name !== "client") return;
      for (const name of list()) {
        if (inPublic(name)) continue;
        this.emitFile({ type: "asset", fileName: name, source: fs.readFileSync(path.join(dir, name)) });
      }
    },
  };
}

export default defineConfig({
  define: {
    __USE_LIBSQL__: false,
  },
  build: {
    // Never inline assets as `data:` URIs. vinext's next/image shim decides
    // whether to route a source through `/_vinext/image` by checking whether
    // the src ends in `.svg`, so any icon Vite inlined (default: everything
    // under 4 KB) was sent to the optimizer as `data:image/svg+xml,…`, which
    // it rejects with 400 — the icon silently rendered as a broken image.
    // Emitting every asset as a real file keeps that extension check working.
    assetsInlineLimit: 0,
    // The /doc route's chunk (Workspace-*.js, 7,520 kB minified as of this
    // commit) is the whole embedded research workspace: research-agent-ui's
    // chat/search/reader plus react-reason-editor's ProseMirror/Tiptap editor,
    // its sidebar and KaTeX. Both halves render on the same screen, so
    // splitting them further changes how many requests fetch that payload but
    // not how much of it /doc needs (its highlight.js grammars are already cut
    // to the common set by `reasonEditorCommonGrammars` above) — and the route is already behind `lazy()`
    // (see app/doc/ResearchAgentEmbed.tsx), which is the one thing the default
    // warning has to suggest. The speech models that *can* load later already
    // do, as their own chunks (moonshine, kokoro, ~2.1 MB each).
    //
    // So the default 500 kB reported the same known chunk on every build and
    // told us nothing. This limit sits just above the measured size instead:
    // it stays quiet for what we knowingly ship and trips the moment that
    // chunk grows. Actually shrinking it means trimming what the workspace
    // pulls in, which is work in research-agent-ui and react-reason-editor,
    // not a bundler setting here.
    chunkSizeWarningLimit: 8000,
    rolldownOptions: {
      onLog(level, log, defaultHandler) {
        if (isVendoredDashPlayerNoise(log)) return;
        defaultHandler(level, log);
      },
    },
  },
  plugins: [
    appStaticFiles(),
    reasonEditorCommonGrammars(),
    // Compiles packages/debate-help-docs/content into the modules the /docs
    // routes (app/docs) render.
    helpDocsMdx(),
    vinext(),
    cloudflare({
      viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
    }),
  ],
  resolve: {
    alias: {
      "@": appDir,
      "@emotion/is-prop-valid": require.resolve("@emotion/is-prop-valid"),
      "@better-auth/kysely-adapter": path.resolve(appDir, "lib/stubs/kysely-adapter.ts"),
      // linkedom (and jsdom) treat `canvas` as an optional peer and require it
      // lazily, falling back to a no-op shim when it is missing. It is a native
      // `.node` addon that cannot run on Workers, and the rsc build fails
      // outright trying to parse the binary, so always resolve it to our own
      // copy of that shim.
      canvas: path.resolve(appDir, "lib/stubs/canvas.ts"),
      // @debate/editor's card-cutter-port.ts dynamically imports
      // `@cardcutter/browser` — the separately-versioned, NOT-shipped
      // card-cutter engine, present only when checked out as a sibling of
      // the CardMirror repo it was ported from. It never is here, so this
      // always resolves to CardMirror's own in-repo no-op stub (mirrors
      // that repo's own vite.config.ts production alias), leaving the
      // (experimental, console-gated) feature inert rather than a bundler
      // resolution error.
      "@cardcutter/browser": path.resolve(
        appDir,
        "../../packages/debate-editor/src/editor/card-cutter-stub.ts",
      ),
    },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react-server-dom-webpack",
      // Keep a single ProseMirror instance across the app: debate-editor
      // (the CardMirror engine) is the only consumer today, but a duplicate
      // ProseMirror module breaks its schema/plugin identity checks the
      // moment anything else in the tree also depends on prosemirror-*.
      "prosemirror-model",
      "prosemirror-state",
      "prosemirror-view",
      "prosemirror-transform",
      "prosemirror-keymap",
      // The /docs routes run Fumadocs inside this app's root layout, whose
      // ThemeProvider comes from @debate/webview's copy of next-themes. One
      // copy means Fumadocs' theme toggle reads and writes that same context.
      "next-themes",
    ],
  },
  optimizeDeps: {
    include: ["@emotion/is-prop-valid"],
  },
  environments: {
    ssr: {
      build: { rolldownOptions: { output: { minify: serverMinify } } },
    },
    rsc: {
      build: { rolldownOptions: { output: { minify: serverMinify } } },
      optimizeDeps: {
        // react-reason-editor → novel → react-tweet, whose `react-server`
        // entry does `import swr from "swr"`; swr's react-server build has no
        // default export, so pre-bundling it for rsc fails and `vinext dev`
        // dies before serving anything. Nothing renders tweets on the server.
        exclude: ["react-tweet"],
      },
    },
  },
  ssr: {
    external: ["@libsql/client"],
    noExternal: [
      "better-auth",
      "better-auth-cloudflare",
      "@better-auth/infra",
      // Workspace packages ship TypeScript sources, so they always have to be
      // bundled rather than externalized to the Cloudflare runtime.
      "reason-editor",
      "@debate/webview",
      "@debate/card-parser",
      "debate-card-search",
      "@debate/data-sync",
      "@debate/editor",
      "@debate/flow-ebb",
      "@debate/round",
      "@debate/timer",
      "@debate/tournaments",
      "@debate/rankings-adapter",
      "@debate/editor-cm-adapter",
      "@debate/videos",
      "@debate/help-docs",
    ],
  },
});
