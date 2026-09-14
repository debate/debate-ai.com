// Stub for @better-auth/kysely-adapter — app uses drizzleAdapter, not kysely.
// This prevents the bun-sqlite-dialect from being bundled into the Cloudflare Worker.
export const getKyselyDatabaseType = () => null;
export const createKyselyAdapter = async () => ({ databaseType: null });
export const kyselyAdapter = () => () => ({});
export type KyselyDatabaseType = "postgres" | "mysql" | "sqlite" | "mssql";

// better-auth's db/get-migration.mjs statically imports these four for its
// kysely schema-diff/migration CLI path (`getMigrations`/`generateSchema`) —
// tooling this app never invokes at runtime (it migrates D1 through Drizzle,
// see apps/debate-ai.com/scripts/migrate-d1.ts), but the bundler still needs
// every named import satisfied. No-ops, matching the stubs above: nothing in
// this app's request path calls them.
export const getMssqlSchema = async () => ({});
export const getPostgresSchema = async () => "public";
export const toIntrospectedTables = () => ({});
export const toPhysicalSchema = () => ({});
