/**
 * Runtime configuration for the vendored upstream code, standing in for
 * upstream's `config.json` (see `overlays/indexcards/api/config.ts`).
 *
 * Only the keys the vendored public routes read have meaningful values;
 * {@link configureTabroom} deep-merges overrides, e.g. from Worker env vars.
 */

export interface TabroomConfig {
  MODE: string;
  logging: { level: string; slowQueryLimit: number };
  cookie: { name: string };
  session_header: string;
  shared_secret: string;
  csrf: { trusted_origins: string[] };
  ratelimiter: { enabled: boolean; message: string; search: Record<string, number> };
  aws: { s3: { bucket: string; region: string; url: string } };
  features: Record<string, boolean>;
  [key: string]: unknown;
}

export const tabroomConfig: TabroomConfig = {
  MODE: "production",
  logging: { level: "warn", slowQueryLimit: 1000 },
  cookie: { name: "TabroomToken" },
  session_header: "x-tabroom-session",
  shared_secret: "",
  csrf: { trusted_origins: [] },
  ratelimiter: { enabled: false, message: "Too many requests", search: {} },
  aws: { s3: { bucket: "", region: "", url: "https://s3.amazonaws.com/tabroom-files" } },
  features: { HIDE_DEV_ENDPOINTS: true },
};

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);

function merge(target: Record<string, unknown>, source: Record<string, unknown>) {
  for (const [key, value] of Object.entries(source)) {
    if (isPlainObject(value) && isPlainObject(target[key])) {
      merge(target[key] as Record<string, unknown>, value);
    } else {
      target[key] = value;
    }
  }
}

/** Deep-merges `overrides` into the live config object the vendored code reads. */
export function configureTabroom(overrides: Partial<TabroomConfig> | Record<string, unknown>): TabroomConfig {
  merge(tabroomConfig as Record<string, unknown>, overrides as Record<string, unknown>);
  return tabroomConfig;
}
