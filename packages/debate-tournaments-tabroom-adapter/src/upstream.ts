/**
 * @fileoverview The one place this package reaches into the submodule.
 *
 * `packages/debate-tournaments-tabroom` is a git submodule of upstream
 * Tabroom (github.com/debate/debate-tournaments). It is an npm workspace of
 * its own — a MariaDB-backed API, a Svelte app and `@tabroom/types` — with its
 * own toolchain, so it stays out of the bun workspace and only
 * `types/` (Zod schemas, needing nothing beyond `zod`) is imported, by path.
 * Keeping every path import here means an upstream reorganization is a
 * one-file fix.
 * @module debate-tournaments-tabroom-adapter/upstream
 */

export * from "../../debate-tournaments-tabroom/types/index";
