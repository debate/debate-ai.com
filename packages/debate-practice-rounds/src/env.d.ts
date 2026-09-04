/**
 * `FlowAnnotationsPanel` renders inside a Next.js app and pulls in
 * `debate-videos`'s YouTube player store, which transitively imports that
 * package's local icon assets (`src/ui/icons`). Referencing Next's ambient
 * types here — exactly as an app's generated next-env.d.ts does — keeps
 * this package type-checkable on its own.
 */
/// <reference types="next" />
/// <reference types="next/image-types/global" />
