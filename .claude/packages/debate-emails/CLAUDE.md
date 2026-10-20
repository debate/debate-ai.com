# CLAUDE.md — `debate-emails`

Published as **`@debate/emails`**: the site's transactional emails as React
Email templates, plus `renderEmail(id, props)` → `{ subject, html, text }`.

- **One registry.** Every template is listed in `src/registry.tsx`
  (`EMAIL_TEMPLATES`) with its subject builder, sample props and the route
  that sends it. The admin Emails section (`/admin#emails`,
  `packages/debate-webview/src/components/admin/EmailsPanel.tsx`) lists
  whatever the registry holds via `GET /api/admin/emails`, so a registered
  template shows up there with no admin change.
- **Inline styles only.** Mail clients drop `<style>`; share the shell and
  text styles through `components/EmailLayout.tsx`.
- **Absolute links.** Build every href with `siteUrl(baseUrl, path)`; senders
  pass the request origin. The logo is `/logo.png` on that origin.
- **Workers runtime.** Rendering goes through `@react-email/render`, which has
  a `workerd` build. Don't add Node-only imports.
- **Never render from a route handler directly.** Routes run in the rsc
  environment, where `react-dom/server` throws. In the app, import
  `renderEmail` / `renderEmailPreview` from `@/lib/emails/render`, which
  runs them in the ssr environment (`lib/emails/ssr-entry.ts`). Importing
  templates, ids and types from `@debate/emails` is fine anywhere.
- Keep it a leaf: no imports from other `debate-*` packages (`site.ts`
  repeats the few constants it needs from `@debate/webview`'s site config).
- Feature copy in `CoachFeaturesEmail` mirrors the coaching and team-research
  help docs; update both together.
- Tests: `test/render.test.ts`; run with
  `bunx vitest run --project @debate/emails` from `apps/debate-web`.
