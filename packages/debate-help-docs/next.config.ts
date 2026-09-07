import { createMDX } from 'fumadocs-mdx/next';
import { resolve } from 'path';

const withMDX = createMDX({});

type MDXNextConfig = NonNullable<Parameters<typeof withMDX>[0]>;

export const config = {
  // output: 'export',
  // distDir: './dist',
  serverExternalPackages: [],
  // The monorepo root, not this package: bun installs this package's own
  // `next` (and the other nested dependencies) as symlinks into the root
  // `node_modules/.bun/` store, which Turbopack refuses to compile from
  // outside its root directory.
  turbopack: {
    root: resolve(import.meta.dirname, '../..'),
  },
  async rewrites() {
    return [
      {
        source: '/docs/:path*.mdx',
        destination: '/docs/llms.mdx/docs/:path*',
      },
    ];
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
