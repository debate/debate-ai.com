/// <reference types="@vitejs/plugin-rsc/types" />
import type { EmailTemplateId, EmailTemplateProps, RenderedEmail } from "@debate-ai/emails";

/**
 * Renders `@debate-ai/emails` templates from a route handler.
 *
 * Route handlers run in the Worker's rsc environment, where `react-dom/server`
 * (which React Email's renderer uses) is the react-server stub that throws, so
 * every render 500'd. The renderer lives in the ssr environment instead
 * (`./ssr-entry.ts`) and is loaded with `import.meta.viteRsc.import`, which
 * @vitejs/plugin-rsc rewrites into an import of that module's ssr build.
 *
 * Templates and their types are still imported from `@debate-ai/emails` directly
 * everywhere else; only rendering has to cross over.
 */
type EmailRenderer = typeof import("./ssr-entry");

async function loadRenderer(): Promise<EmailRenderer> {
  return import.meta.viteRsc.import<EmailRenderer>("./ssr-entry", { environment: "ssr" });
}

export async function renderEmail<Id extends EmailTemplateId>(
  id: Id,
  props: EmailTemplateProps[Id],
): Promise<RenderedEmail> {
  return (await loadRenderer()).renderEmail(id, props);
}

export async function renderEmailPreview(id: EmailTemplateId, baseUrl?: string): Promise<RenderedEmail> {
  return (await loadRenderer()).renderEmailPreview(id, baseUrl);
}
