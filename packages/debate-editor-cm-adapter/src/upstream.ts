/**
 * @fileoverview The one place this package reaches into the submodule.
 *
 * `packages/debate-editor-cm` is a git submodule of upstream CardMirror
 * (github.com/debate/debate-editor). It is a standalone Vite app with its own
 * toolchain, so it is kept out of the bun workspace and imported by path —
 * only its framework-free core (schema, `.docx` import/export, the native
 * `.cmir` format), which needs nothing beyond ProseMirror, fflate and
 * fast-xml-parser. Keeping every path import here means an upstream
 * reorganization is a one-file fix.
 * @module debate-editor-cm-adapter/upstream
 */

export * from "../../debate-editor-cm/src/index";
