/**
 * @fileoverview Shared page chrome for the standalone tool routes.
 *
 * Every training, practice, and research-collaboration page used to open
 * with the same hand-rolled "← Back" button and nothing else — no title,
 * no description, no way to tell which of the forty-odd tools you'd landed
 * on, and no link to the tool's documentation. `ToolPage` + `ToolPageHeader`
 * replace that with one consistent header:
 *
 * - a back link that names where it goes,
 * - the tool's icon, title, and one-line description (defaulting to the
 *   same copy the `/tools` catalog shows, via `app/tools/tool-groups.ts`),
 * - an eyebrow naming the guide the tool belongs to (training / practice /
 *   research collaboration),
 * - "Docs" and "Guide" links into the Fumadocs site (`lib/docs-links.ts`),
 * - the same favorite-star toggle as the `/tools` grid, and
 * - an optional row of related-tool links (`RoundToolsCrossLinks`).
 *
 * Both components are server-renderable; the only client piece is
 * `FavoriteToolButton`, which already marks itself `"use client"`.
 *
 * @module components/tools/ToolPageHeader
 */

import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowLeft, BookOpen, Compass, type LucideIcon } from "lucide-react"
import { ALL_TOOLS } from "@/app/tools/tool-groups"
import {
  DOCS_GUIDE_LABELS,
  DOCS_GUIDE_TITLES,
  featureDocsUrlForRoute,
  guideDocsUrl,
  type DocsGuide,
} from "@/lib/docs-links"
import { cn } from "@/lib/ui/lib/utils"
import { FavoriteToolButton } from "./FavoriteToolButton"

/** Props for {@link ToolPage}. */
export interface ToolPageProps {
  /** Page content — usually a {@link ToolPageHeader} followed by the tool's panel(s). */
  children: ReactNode
  /** Extra classes for the centered content column. */
  className?: string
}

/**
 * Full-height page shell with the app's standard padding and a centered,
 * width-capped content column.
 *
 * @param props - See {@link ToolPageProps}.
 */
export function ToolPage({ children, className }: ToolPageProps) {
  return (
    <div className="min-h-screen bg-background p-3 pb-24 sm:p-6 sm:pb-24">
      <div className={cn("mx-auto flex max-w-7xl flex-col gap-4", className)}>{children}</div>
    </div>
  )
}

/** Props for {@link ToolPageHeader}. */
export interface ToolPageHeaderProps {
  /** The page's own route (e.g. `"/drills"`); used to look up catalog copy, the feature doc, and favorite state. */
  href: string
  /** Where the back link goes. */
  backHref: string
  /** Where the back link goes, in words (e.g. `"round workspace"`). */
  backLabel: string
  /** Page title; defaults to the `/tools` catalog label for `href`. */
  title?: string
  /** One-line description; defaults to the `/tools` catalog description for `href`. */
  description?: string
  /** Leading icon; defaults to the `/tools` catalog icon for `href`. */
  icon?: LucideIcon
  /** Which task guide this tool belongs to; adds the eyebrow and the "Guide" link. */
  guide?: DocsGuide
  /** Extra controls rendered next to the docs links (right side of the top row). */
  actions?: ReactNode
  /** Rendered under the title block — typically a related-tools link row. */
  children?: ReactNode
}

/**
 * Standard header for a standalone tool page.
 *
 * @param props - See {@link ToolPageHeaderProps}.
 */
export function ToolPageHeader({
  href,
  backHref,
  backLabel,
  title,
  description,
  icon,
  guide,
  actions,
  children,
}: ToolPageHeaderProps) {
  const tool = ALL_TOOLS.find((entry) => entry.href === href)
  const Icon = icon ?? tool?.icon
  const resolvedTitle = title ?? tool?.label ?? href
  const resolvedDescription = description ?? tool?.description
  const docsUrl = featureDocsUrlForRoute(href)

  return (
    <header className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href={backHref}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>
            Back <span className="hidden text-muted-foreground sm:inline">to {backLabel}</span>
          </span>
        </Link>

        <div className="flex flex-wrap items-center gap-1.5">
          {actions}
          {docsUrl ? (
            <HeaderLink href={docsUrl} icon={BookOpen} label="Docs" title={`Read the ${resolvedTitle} documentation`} />
          ) : null}
          {guide ? (
            <HeaderLink
              href={guideDocsUrl(guide)}
              icon={Compass}
              label="Guide"
              title={`Open the ${DOCS_GUIDE_TITLES[guide].toLowerCase()}`}
            />
          ) : null}
          {tool ? (
            <FavoriteToolButton
              href={tool.href}
              label={tool.label}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background p-0"
            />
          ) : null}
        </div>
      </div>

      <div className="flex items-start gap-3">
        {Icon ? (
          <span
            aria-hidden="true"
            className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"
          >
            <Icon className="h-5 w-5" />
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          {guide ? (
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
              {DOCS_GUIDE_LABELS[guide]}
            </p>
          ) : null}
          <h1 className="text-xl font-semibold leading-tight text-foreground sm:text-2xl">{resolvedTitle}</h1>
          {resolvedDescription ? (
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{resolvedDescription}</p>
          ) : null}
        </div>
      </div>

      {children ? <div className="rounded-lg border border-border bg-muted/40 px-3 py-2">{children}</div> : null}
    </header>
  )
}

function HeaderLink({
  href,
  icon: Icon,
  label,
  title,
}: {
  href: string
  icon: LucideIcon
  label: string
  title: string
}) {
  const external = /^https?:\/\//.test(href)
  return (
    <a
      href={href}
      title={title}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
    >
      <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      {label}
    </a>
  )
}
