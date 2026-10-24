# @debate-ai/emails

Debate AI's transactional emails, written with [React Email](https://react.email).

| Template id | Email | Sent by |
| --- | --- | --- |
| `welcome` | Welcome to Debate AI, with the tools most people start with | nothing yet |
| `file-invite` | Someone invited you to collaborate on a file | `POST /api/card-shares` |
| `round-invite` | Someone invited you to a debate round | `POST /api/rounds/invite` |
| `coach-features` | What coaches get: managing a research team, coaching programs and more | nothing yet |

```ts
import { renderEmail } from "@debate-ai/emails";

const { subject, html, text } = await renderEmail("round-invite", {
  inviterName: "Alex Chen",
  tournamentName: "Harvard",
  roundLevel: "Octafinals",
  link: "/debate/2026-harvard/octas",
  baseUrl: new URL(request.url).origin,
});
await resend.emails.send({ from, to, subject, html, text });
```

Pass `baseUrl` (the request's origin) so links and the logo point at the
deployment that sent the email; it falls back to `https://d.ebate.app`. The
logo is the app's `/logo.png`, the root copy of `@debate-ai/icons/brand`'s
wordmark, because mail clients need an absolute image URL.

Every template exports sample `PreviewProps`. `renderEmailPreview(id)`
renders a template with them, and the admin panel's **Emails** section
(`/admin#emails`) shows the HTML and plain-text parts and can send a test to
the signed-in admin.

Rendering uses `@react-email/render`, whose `workerd` export condition picks
its edge build on Cloudflare Workers. It needs `react-dom/server`, so it
can't run in a React Server Components environment: in the web app, route
handlers render through `apps/debate-web/lib/emails/render.ts`, which runs
it in the Worker's ssr environment.

To add a template, write it under `src/templates/`, wrap it in
`EmailLayout`, give it `PreviewProps`, and register it in `src/registry.tsx`.
