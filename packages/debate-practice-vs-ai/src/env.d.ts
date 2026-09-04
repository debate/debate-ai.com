/**
 * This package re-exports `debate-round`'s `AiVersusRoundPanel`, which
 * transitively pulls in local icon assets (`src/ui/icons`, and
 * `debate-videos`'s own via `FlowAnnotationsPanel`). Referencing Next's
 * ambient types here — exactly as an app's generated next-env.d.ts does —
 * keeps this package type-checkable on its own.
 */
/// <reference types="next" />
/// <reference types="next/image-types/global" />
