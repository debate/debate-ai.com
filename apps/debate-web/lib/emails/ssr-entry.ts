/**
 * Email rendering, loaded into the Worker's ssr environment. Route handlers
 * run in the rsc environment, where React is its react-server build and
 * `react-dom/server` throws on import, so `@debate-ai/emails` can only render
 * here. Route handlers reach it through `./render.ts`.
 */
export { renderEmail, renderEmailPreview } from "@debate-ai/emails";
