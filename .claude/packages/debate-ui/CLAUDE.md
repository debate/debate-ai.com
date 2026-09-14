# CLAUDE.md — `debate-ui`

Private. The shared UI kit: shadcn/Radix primitives, the custom icon set, the
site footer, and the `cn` / URL-state helpers every other package builds on.
Tests in `test/`.

## Cheap to change, expensive to get wrong

**Every surface in the product renders this package.** There is no such thing as
a local change here. Before editing a primitive:

- Grep for its usages across `packages/*` and `apps/debate-ai.com`. A prop
  rename is a repo-wide refactor.
- Changing default styling, spacing or variants restyles screens you have not
  looked at — including the live round workspace, where layout regressions cost
  a debater time they can't get back.
- **Don't add product logic here.** A primitive that knows what a "card" or a
  "round" is belongs in the package that owns that concept. This kit stays
  domain-free.

## Conventions

- Follow the shadcn/Radix idiom already in use: unstyled Radix behaviour plus
  `cn`-composed classes, variants over one-off props, `asChild` for composition.
- **`cn` and the URL-state helpers are the most-imported code in the repo.**
  Their signatures are API; extend, don't change.
- The icon set is custom — add icons to it rather than importing a second icon
  library into a consumer.
- Accessibility comes from Radix; don't replace a Radix primitive with a bare
  `div` and lose it.
