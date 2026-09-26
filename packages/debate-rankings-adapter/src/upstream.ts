/**
 * @fileoverview The one place this package reaches into the submodule.
 *
 * `packages/debate-rankings` is a git submodule of upstream
 * (github.com/debate/debate-rankings). Its Python pipeline and generated CSVs
 * have their own toolchain, so it stays out of the bun workspace and only its
 * TypeScript entry point is imported, by path — a bare `workspace:*`
 * dependency would make `bun install` fail outright whenever the submodule
 * has not been checked out. Keeping the path import here means an upstream
 * reorganization is a one-file fix.
 * @module debate-rankings-adapter/upstream
 */

export * from "../../debate-rankings/js/index";
