/**
 * Server-side entry: the API handler, the D1 plumbing and the migration.
 * Import from `debate-tournaments/server` in route handlers and Workers only —
 * it pulls in the vendored upstream API.
 */
export { createTournamentsHandler, routedPath, type TournamentsHandlerOptions } from "./api/handler";
export { actorForHostUser, anonymousActor, findPersonByEmail, type HostUser, type TabroomActor, type TabroomPerson } from "./api/actor";
export { runExpressRouter } from "./api/express-adapter";
export { D1Dialect, createTabroomKysely } from "./db/d1-dialect";
export { runWithTabroomDb, setDefaultTabroomDb, getTabroomD1, getTabroomKysely } from "./db/runtime";
export { d1FromLibsql, type LibsqlClientLike } from "./db/libsql-d1";
export { translateMysqlToSqlite } from "./db/mysql-compat";
export { configureTabroom, tabroomConfig, type TabroomConfig } from "./config";
export { TABLES as TABROOM_TABLES } from "./db/generated/columns";
export type { D1DatabaseLike, D1PreparedStatementLike, D1Result } from "./db/d1-types";
