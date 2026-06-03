import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const monoRoot = resolve(__dirname, "../..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  transpilePackages: ["react-resizable-panels"],
  serverExternalPackages: [
    "better-auth",
    "@better-auth/kysely-adapter",
    "kysely",
    "drizzle-orm",
    "@libsql/client",
    "libsql",
  ],
  turbopack: {
    root: monoRoot,
  },
  outputFileTracingRoot: monoRoot,
  webpack(config, { isServer }) {
    // Skip Service Worker bundling on server side
    if (isServer) {
      return config;
    }

    config.module.rules.push({
      test: /\.(ogg|mp3|wav|mpe?g)$/i,
      type: "asset/resource",
      generator: {
        filename: "static/chunks/[path][name].[hash][ext]",
      },
    });
    return config;
  },
};

export default nextConfig;
