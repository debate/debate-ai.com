import "dotenv/config";
import { defineConfig } from "drizzle-kit";

/**
 * One Drizzle config for both targets.
 *
 * - Default: a local SQLite/libSQL file (`DATABASE_URL`, falling back to
 *   `file:./data/db.sqlite`). Used by `db:generate`, `db:push`, `db:studio`.
 * - `DRIZZLE_TARGET=d1`: the remote Cloudflare D1 over HTTP, using
 *   `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_DATABASE_ID` and `CLOUDFLARE_D1_TOKEN`.
 *   Used by `db:push:d1`.
 *
 * The target is opt-in on purpose: having the Cloudflare credentials in `.env`
 * never points a plain `db:push` at production.
 */
const common = {
  dialect: "sqlite",
  schema: "./lib/database/schema.ts",
  out: "./drizzle",
} as const;

export default process.env.DRIZZLE_TARGET === "d1"
  ? defineConfig({
      ...common,
      driver: "d1-http",
      dbCredentials: {
        accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
        databaseId: process.env.CLOUDFLARE_DATABASE_ID!,
        token: process.env.CLOUDFLARE_D1_TOKEN!,
      },
    })
  : defineConfig({
      ...common,
      dbCredentials: {
        url: process.env.DATABASE_URL || "file:./data/db.sqlite",
      },
    });
