/**
 * Cloudflare Workers context utilities for database access
 */

import { AsyncLocalStorage } from "async_hooks";
import { getDB } from "./index";

interface CloudflareContext {
  env: {
    debate_db?: D1Database;
    [key: string]: any;
  };
}

// AsyncLocalStorage to maintain request context
const contextStorage = new AsyncLocalStorage<CloudflareContext>();

/**
 * Set Cloudflare context for the current request
 * Called by the worker entry point
 */
export function setCloudflareContext(env: any) {
  const store = contextStorage.getStore();
  if (store) {
    store.env = env;
  }
}

/**
 * Get Cloudflare context for the current request
 */
export function getCloudflareContext(): CloudflareContext | undefined {
  return contextStorage.getStore();
}

/**
 * Get database instance with automatic D1 binding detection
 * Checks Cloudflare context first, falls back to local libSQL
 */
export async function getDBFromContext() {
  const context = getCloudflareContext();
  const d1 = context?.env?.debate_db;
  return getDB(d1);
}

/**
 * Run a function with Cloudflare context
 * Used by worker entry point to wrap request handlers
 */
export function runWithContext<T>(env: any, fn: () => T): T {
  return contextStorage.run({ env }, fn);
}
