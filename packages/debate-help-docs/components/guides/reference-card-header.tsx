"use client"
/**
 * @file reference-card-header.tsx
 * @description The text and edge icons of one entry in the References side
 * panel (`references-panel.tsx`):
 *
 *   line 1  the card's summary
 *   line 2  `Authors ’yy — qualifications`, then the full Chicago citation
 *
 * and, on the card's top edge, small flags: what kind of source it is, whether
 * the author is a qualified professor, and whether the author is an institution.
 * The splitting and the regexes behind the flags are `lib/reference-display.ts`.
 */
import { useMemo } from "react"
import {
  Book,
  FileText,
  Gamepad2,
  Globe,
  GraduationCap,
  Landmark,
  Newspaper,
  Rss,
  Scale,
  Video,
  BookText,
  type LucideIcon,
} from "lucide-react"
import { formatCitation } from "../../lib/citation-styles"
import {
  SOURCE_KIND_LABELS,
  classifySource,
  isInstitutionAuthor,
  isProfessor,
  parseReferenceCard,
  stripAuthorFromQualification,
  yearTick,
  type ParsedReferenceCard,
  type SourceKind,
} from "../../lib/reference-display"
import { useCitationStyle } from "./citation-style-switcher"
import type { ReferenceItem } from "./references-panel-items"

const SOURCE_ICONS: Record<SourceKind, LucideIcon> = {
  court: Scale,
  game: Gamepad2,
  video: Video,
  report: FileText,
  journal: BookText,
  book: Book,
  blog: Rss,
  news: Newspaper,
  web: Globe,
  other: FileText,
}

/** Everything the panel shows for one entry, worked out from its link data. */
export interface ReferenceDisplay {
  card: ParsedReferenceCard
  authors: string
  tick: string
  qualification: string
  kind: SourceKind
  professor: boolean
  institution: boolean
}

/** The year as cited, falling back to the one in the in-text label (`Smith (2019)`). */
function yearOf(item: ReferenceItem): string {
  return item.year || item.label.match(/\d{4}|n\.d\./)?.[0] || ""
}

export function describeReference(item: ReferenceItem): ReferenceDisplay {
  const card = parseReferenceCard(item.card)
  return {
    card,
    authors: item.authors,
    tick: yearTick(yearOf(item)),
    qualification: stripAuthorFromQualification(card.qualification, item.authors),
    kind: classifySource(item.citation, card.summary),
    professor: isProfessor(card.qualification),
    institution: isInstitutionAuthor(item.authors, item.citation),
  }
}

/** The two text lines of an entry. */
export function ReferenceCardLines({ item, display }: { item: ReferenceItem; display: ReferenceDisplay }) {
  const style = useCitationStyle()
  const citation = useMemo(() => formatCitation(item.citation, style), [item.citation, style])
  const { card, authors, tick, qualification } = display
  const who = [authors, tick].filter(Boolean).join(" ")
  return (
    <>
      {card.summary && <span className="block text-[0.8rem] font-semibold leading-snug">{card.summary}</span>}
      <span className="mt-0.5 block text-fd-muted-foreground">
        {who && <strong className="font-semibold text-fd-foreground">{who}</strong>}
        {qualification && (
          <>
            {who && " — "}
            {qualification.replace(/\.$/, "")}.
          </>
        )}{" "}
        <span dangerouslySetInnerHTML={{ __html: citation }} />
      </span>
    </>
  )
}

const flag =
  "grid size-5 place-items-center rounded-full border bg-fd-background text-fd-muted-foreground shadow-sm [&_svg]:size-3"

/** The flags on the card's top edge. */
export function ReferenceEdgeIcons({ display }: { display: ReferenceDisplay }) {
  const Kind = SOURCE_ICONS[display.kind]
  return (
    <span className="absolute -top-2.5 right-3 flex gap-1" data-reference-flags="">
      {display.institution && (
        <span className={flag} title="Institutional author" data-flag="institution">
          <Landmark aria-hidden />
        </span>
      )}
      {display.professor && (
        <span className={flag} title="Qualified professor" data-flag="professor">
          <GraduationCap aria-hidden />
        </span>
      )}
      <span className={flag} title={SOURCE_KIND_LABELS[display.kind]} data-flag={`source-${display.kind}`}>
        <Kind aria-hidden />
      </span>
    </span>
  )
}
