/**
 * This package re-exports `debate-practice-rounds`'s `AiVersusRoundPanel`,
 * which transitively pulls in `debate-videos`'s local icon assets
 * (`src/ui/icons`) via `FlowAnnotationsPanel`. Referencing Next's ambient
 * types here — exactly as an app's generated next-env.d.ts does — keeps
 * this package type-checkable on its own.
 */
/// <reference types="next" />
/// <reference types="next/image-types/global" />
