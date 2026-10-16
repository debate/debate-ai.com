/**
 * Typecheck-only surface of `@debate/help-docs/routes/*`, mapped in by
 * `tsconfig.typecheck.json`.
 *
 * The app's `app/docs` files only re-export these route modules. Letting `tsc`
 * follow them into the package pulls in Fumadocs' whole type graph (the MDX
 * collections, fumadocs-openapi), which takes this app's typecheck past
 * Node's default heap. The package typechecks its own sources in its own
 * `typecheck` task, so here the app only needs the shapes it re-exports.
 * One declaration covers every route module; each app file re-exports the
 * subset its route needs.
 */
import type { Metadata } from "next"
import type { ReactNode } from "react"

declare const Route: (props: { children?: ReactNode; params?: Promise<any> }) => ReactNode | Promise<ReactNode>
export default Route

export const metadata: Metadata
export function generateMetadata(props: { params: Promise<any> }): Promise<Metadata>
export function generateStaticParams(): unknown[] | Promise<unknown[]>
export function GET(request: Request, context: { params: Promise<any> }): Response | Promise<Response>

/**
 * `@debate/help-docs/lib/fumadocs/sitemap-helper` (see
 * `packages/debate-help-docs/lib/fumadocs/sitemap-helper.ts`), declared here
 * for the same reason as the route modules above and mapped in by
 * `tsconfig.typecheck.json`.
 */
export function docsPageUrls(): string[]
