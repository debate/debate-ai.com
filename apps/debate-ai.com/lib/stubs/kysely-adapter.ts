// Stub for @better-auth/kysely-adapter — app uses drizzleAdapter, not kysely.
// This prevents the bun-sqlite-dialect from being bundled into the Cloudflare Worker.
export const getKyselyDatabaseType = () => null;
export const createKyselyAdapter = async () => ({ databaseType: null });
export const kyselyAdapter = () => () => ({});
export type KyselyDatabaseType = "postgres" | "mysql" | "sqlite" | "mssql";
