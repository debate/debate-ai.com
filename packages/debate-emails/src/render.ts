import { render } from "@react-email/components";
import { EMAIL_TEMPLATES_BY_ID, type EmailTemplateId, type EmailTemplateProps } from "./registry";

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/**
 * Renders a template to the subject, HTML and plain-text bodies a provider
 * such as Resend takes. `@react-email/render` resolves to its `workerd` build
 * on Cloudflare Workers, so this runs the same in the Worker, Node and tests.
 */
export async function renderEmail<Id extends EmailTemplateId>(
  id: Id,
  props: EmailTemplateProps[Id],
): Promise<RenderedEmail> {
  const template = EMAIL_TEMPLATES_BY_ID[id];
  const element = template.element(props);
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
  return { subject: template.subject(props), html, text };
}

/** Renders a template with its sample data, for previews. */
export function renderEmailPreview(id: EmailTemplateId, baseUrl?: string): Promise<RenderedEmail> {
  const template = EMAIL_TEMPLATES_BY_ID[id];
  return renderEmail(id, { ...template.sampleProps, baseUrl } as EmailTemplateProps[typeof id]);
}
