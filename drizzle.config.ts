import type { Config } from "drizzle-kit";

export default {
  schema: "./src/lib/db/schema.js",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: './sqlite.db',
  },
} satisfies Config;