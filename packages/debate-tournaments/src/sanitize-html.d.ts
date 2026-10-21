/** The slice of `sanitize-html`'s API that `paradigms-server.ts` uses (the package ships no types). */
declare module "sanitize-html" {
  interface SanitizeOptions {
    allowedTags?: string[] | false;
    allowedAttributes?: Record<string, string[]> | false;
    allowedSchemes?: string[];
    transformTags?: Record<string, (tagName: string, attribs: Record<string, string>) => { tagName: string; attribs: Record<string, string> }>;
  }
  interface SanitizeHtml {
    (dirty: string, options?: SanitizeOptions): string;
    simpleTransform(tagName: string, attribs: Record<string, string>, merge?: boolean): (tagName: string, attribs: Record<string, string>) => { tagName: string; attribs: Record<string, string> };
  }
  const sanitizeHtml: SanitizeHtml;
  export default sanitizeHtml;
}
