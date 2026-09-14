import { createMDX } from 'fumadocs-mdx/next';
import { resolve } from 'path';
import { DOCS_BASE_PATH } from './lib/fumadocs/base-path';

const withMDX = createMDX({});

type MDXNextConfig = NonNullable<Parameters<typeof withMDX>[0]>;

export const config = {
  // The docs are published as part of debate-ai.com, not as their own origin:
  // this app is statically exported and the export is copied into
  // `apps/debate-ai.com/public/docs` by that app's `build:docs` step, so the
  // Worker serves it as plain static assets under /docs. Every page is
  // prerendered already (no server routes, no revalidation), so `export` costs
  // nothing over the previous build.
  output: 'export',
  // Serving under /docs is what makes `debate-ai.com/docs` work: it prefixes
  // every route, `<Link>` href, and `_next/` asset URL, and — critically for
  // sharing an origin with the main app — moves the router's own payload files
  // out of the site root, where they would otherwise collide with the main
  // app's identically-named ones.
  basePath: DOCS_BASE_PATH,
  serverExternalPackages: [],
  // The monorepo root, not this package: bun installs this package's own
  // `next` (and the other nested dependencies) as symlinks into the root
  // `node_modules/.bun/` store, which Turbopack refuses to compile from
  // outside its root directory.
  turbopack: {
    root: resolve(import.meta.dirname, '../..'),
  },
  reactStrictMode: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.imgur.com',
      },
    ],
    unoptimized: true,
  },
} satisfies MDXNextConfig;
export default withMDX(config);
