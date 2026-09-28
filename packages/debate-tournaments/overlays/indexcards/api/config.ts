/**
 * debate-tournaments overlay — replaces upstream's `api/config.ts`.
 *
 * Upstream reads `config.json` from disk and validates it with zod at import
 * time; a Worker has no filesystem. This is the same shape with the values the
 * vendored public routes read, overridable at runtime via
 * `configureTabroom()` (see `src/config.ts`).
 */
import { tabroomConfig } from '../../../../src/config.js';

export default tabroomConfig;
