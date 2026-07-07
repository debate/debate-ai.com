/**
 * LibSQL client for local development
 * This module is NOT used in Cloudflare Workers
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

let db: any = null;

export async function getLibSQLDB() {
  if (!db) {
    const client = createClient({
      url: process.env.DATABASE_URL || "file:./data/db.sqlite",
      authToken: process.env.DATABASE_AUTH_TOKEN,
    });
    db = drizzle(client, { schema });
  }
  return db;
}
