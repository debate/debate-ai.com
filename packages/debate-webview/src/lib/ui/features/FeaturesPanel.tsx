/**
 * @fileoverview Features page panel — the single page that outlines every
 * user-facing surface in the app.
 *
 * The dock's Settings menu already links to most of these, but as a flat,
 * unexplained list of forty-odd items; `/research` and `/coaching` each tab
 * across one package's panels. This panel is the whole map:
 * `feature-catalog.ts`'s `APP_FEATURES` grouped into categories, filtered by
 * one free-text box (which also matches each entry's route and hidden
 * search tags), with a jump-to-category row for skimming and a link to each
 * feature's long-form doc where one exists.
 *
 * The presentation is a marketing page rather than a settings list, using the
 * primitives in `./effects` — an aurora hero, counted-up totals, a ticker of
 * every surface, and spotlight cards that reveal as they scroll in. Their
 * colour comes from `globals.css`'s `--accent-hue` / `--accent-secondary-hue`
 * pair rather than a palette of the page's own, so the page reads as part of
 * the app in both light and dark. Each card rotates that accent by its own
 * angle (`cardHueShift`) for its hover state alone, so pointing at a card
 * lights it in a colour no neighbour shares while the grid at rest stays on
 * the single app accent.
 *
 * It has no store: every card just links to a surface that already manages
 * its own state.
 *
 * @module features/FeaturesPanel
 */

"use client";

import { useEffect, useMemo, useState, type ComponentType } from "react";
import {
  Dumbbell,
  ExternalLink,
  FileText,
  LayoutGrid,
  Library,
  Play,
  Radar,
  Search,
  Sparkles,
  Table2,
  Trophy,
  Users,
} from "lucide-react";

import { DownloadAppButton } from "react-native-app-buttons";

import { Input } from "../primitives/input";
import { cn } from "../lib/utils";
import { EmptyState } from "../panels/panel-shell";
import {
  AuroraBackdrop,
  cardHueShift,
  Marquee,
  Pill,
  Reveal,
  SpotlightCard,
} from "./effects";
import {
  APP_FEATURES,
  buildFeatureSections,
  featureDocUrl,
  searchFeatures,
  type FeatureCategory,
  type FeatureEntry,
} from "../../feature-catalog";
import { APP_LOGO, APP_LOGO_HEIGHT, APP_LOGO_WIDTH, APP_NAME } from "../../config/site";
import { README_BADGE_ROWS, README_BANNER, README_SHOWCASE, README_VIDEO } from "./readme-media";
import {
  CARDS_CAPABILITIES,
  CARDS_DOIS,
  CARDS_OVERVIEW,
  CARDS_TITLE,
  CARDS_VISION,
} from "./cards-vision";

/**
 * A glyph per category, so a section is identifiable before its heading is
 * read. Keyed by the same slugs `FEATURE_CATEGORY_LABELS` uses.
 */
const CATEGORY_ICONS: Record<FeatureCategory, ComponentType<{ className?: string }>> = {
  workspaces: LayoutGrid,
  evidence: Library,
  collaboration: Users,
  round: Table2,
  intelligence: Radar,
  practice: Dumbbell,
  recognition: Trophy,
};

/**
 * Google Drive folder of PDF guides shown at the foot of the page. Drive's
 * `embeddedfolderview` is mounted up front so the folder's items are listed
 * as soon as the reader scrolls to it; `loading="lazy"` keeps the viewer's
 * script from being fetched until the section nears the viewport, so the
 * hero above isn't slowed by it.
 */
const DOCUMENTS_DRIVE_FOLDER_ID = "1inxyWjAkPiyJ9BdspbhV20_-xRIc8RJn";
const DOCUMENTS_DRIVE_FOLDER_URL = `https://drive.google.com/drive/folders/${DOCUMENTS_DRIVE_FOLDER_ID}`;

/**
 * The documents section: Drive's own folder viewer, preloaded in place, with
 * a link out to the folder on Drive.
 */
function DocumentsFolder() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <p className="text-sm font-semibold text-foreground">PDF guides and handouts</p>
        <a
          href={DOCUMENTS_DRIVE_FOLDER_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          Open in Google Drive
          <ExternalLink className="size-3.5" />
        </a>
      </div>
      <iframe
        src={`https://drive.google.com/embeddedfolderview?id=${DOCUMENTS_DRIVE_FOLDER_ID}#grid`}
        title="PDF documents"
        width="100%"
        height="800"
        loading="lazy"
        style={{ border: 0 }}
        data-testid="documents-folder-viewer"
      />
    </div>
  );
}

/**
 * The project's YouTube video, embedded behind a click.
 *
 * Mounted on click: an embed
 * pulls the whole third-party player — script, fonts and tracking — down the
 * moment it is in the document, and this page is a marketing surface most
 * visitors reach after already passing the Turnstile gate. A poster frame and a
 * play button cost one image, and nothing from YouTube is requested until
 * someone asks for it.
 *
 * `rel="0"` on the embed keeps YouTube from offering "more from this channel"
 * beneath the player, which would pull the reader out of the page they came
 * for. The `youtube-nocookie` host (see `readme-media.ts`) is the privacy half
 * of the same decision: no tracking cookies until playback actually starts.
 */
function FeatureVideo() {
  const [play, setPlay] = useState(false);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {play ? (
          <div className="aspect-video">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${README_VIDEO.id}?rel=0`}
              title={README_VIDEO.title}
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="size-full border-0"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setPlay(true)}
            className="group relative block aspect-video w-full cursor-pointer"
            aria-label={`Play video: ${README_VIDEO.title}`}
          >
            <img
              src={README_VIDEO.thumbnail}
              alt=""
              loading="lazy"
              decoding="async"
              className="size-full object-cover"
            />
            <span className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent transition-opacity group-hover:opacity-90" />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex size-16 items-center justify-center rounded-full bg-black/55 backdrop-blur-sm transition-transform group-hover:scale-110">
                <Play className="size-7 translate-x-0.5 text-white" fill="currentColor" />
              </span>
            </span>
            <span className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 px-4 pb-3 text-left">
              <span className="text-sm font-semibold text-white">{README_VIDEO.title}</span>
              <a
                href={README_VIDEO.watchUrl}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 text-xs text-white/80 underline underline-offset-2 hover:text-white"
                // The play button is a <button>, so this link sits inside it.
                // Without stopping the click, following the link would mount the
                // embed and then navigate away from the page that mounted it.
                onClick={(event) => event.stopPropagation()}
              >
                Watch on YouTube
              </a>
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

/** Props for {@link FeaturesPanel}. */
export interface FeaturesPanelProps {
  /** Catalog to render; defaults to every feature in the app. */
  entries?: FeatureEntry[];
  /** Extra classes for the outer element. */
  className?: string;
}

/**
 * Renders the features page: a searchable, category-grouped outline of every
 * surface in the app.
 *
 * @param props - See {@link FeaturesPanelProps}.
 * @returns The features page element.
 */
export function FeaturesPanel({ entries = APP_FEATURES, className }: FeaturesPanelProps) {
  const [query, setQuery] = useState("");
  const [hueOffset, setHueOffset] = useState(0);

  useEffect(() => {
    // Randomize card hover colours on each page load so every visit gets a unique, vibrant palette
    setHueOffset(Math.floor(Math.random() * 360));
  }, []);

  const sections = useMemo(
    () => buildFeatureSections(searchFeatures(entries, query)),
    [entries, query],
  );

  const allSections = useMemo(() => buildFeatureSections(entries), [entries]);

  // A card's hover colour comes from its place in the whole catalog plus the
  // randomized page-load offset, not in the filtered grid, so a feature keeps
  // the same colour while someone types rather than every card changing hue on
  // each keystroke.
  const hueShifts = useMemo(() => {
    const byId = new Map<string, number>();
    entries.forEach((entry, index) => byId.set(entry.id, cardHueShift(index, hueOffset)));
    return byId;
  }, [entries, hueOffset]);

  // Two ticker rows out of one list, so the second can run the other way and
  // the pair doesn't read as one long line wrapped twice.
  const tickerRows = useMemo(() => {
    const half = Math.ceil(entries.length / 2);
    return [entries.slice(0, half), entries.slice(half)].filter((row) => row.length > 0);
  }, [entries]);

  return (
    <div className={cn("da-features relative", className)} data-testid="features-panel">
      {/* `Reveal` renders its hidden state during SSR too, so without this the
          whole page would stay faded out for a reader with JS disabled — the
          reveal never runs to un-hide it. */}
      <noscript>
        <style>{`[data-da-reveal="hidden"]{opacity:1;transform:none}`}</style>
      </noscript>

      <section className="relative overflow-hidden px-4 pt-14 pb-10 sm:px-6 sm:pt-20 lg:px-8">
        <AuroraBackdrop />

        <div className="mx-auto max-w-4xl text-center">
          <Reveal>
            <img
              src={APP_LOGO}
              alt={APP_NAME}
              width={APP_LOGO_WIDTH}
              height={APP_LOGO_HEIGHT}
              className="mx-auto mb-6 h-auto w-full max-w-[320px]"
            />
          </Reveal>

          <Reveal>
            <img
              src={README_BANNER}
              alt="Debate AI"
              width={800}
              className="mx-auto mb-8 w-full max-w-3xl"
            />
          </Reveal>

          <Reveal>
            <Pill className="mb-5">
              <LayoutGrid className="size-3.5" />
              PF, LD and Policy — every tool
            </Pill>
          </Reveal>

          <Reveal delay={80}>
            <h1 className="text-4xl leading-[1.08] font-bold tracking-tight text-balance text-foreground sm:text-5xl">
              Cut, flow, drill, debate.
              <br />
              <span className="da-shimmer-text">All of it, here.</span>
            </h1>
          </Reveal>

          <Reveal delay={160}>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg">
              Cut and tag evidence, flow a live round, time every speech, scout judges and
              opponents, and take a full round against an AI. Search by tool, by route, or by
              the word you would actually say in a block — then open it straight from its card.
            </p>
          </Reveal>

          <Reveal delay={220}>
            <div className="relative mx-auto mt-8 max-w-xl">
              {/* Above the input, not just before it: the field's own
                  `backdrop-blur` paints a layer that would otherwise wash the
                  glyph out. */}
              <Search
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3.5 z-10 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search features by name, description, route, or keyword…"
                aria-label="Search features"
                className="h-11 rounded-full border-border bg-card/80 pl-10 backdrop-blur-sm"
              />
            </div>
        </Reveal>

        <Reveal delay={340}>
            {/* The root README's badge block, row for row. */}
            <div className="mt-8 flex flex-col items-center gap-2" data-testid="readme-badges">
              {README_BADGE_ROWS.map((row, rowIndex) => (
                <div key={rowIndex} className="flex flex-wrap items-center justify-center gap-1.5">
                  {row.map((badge) => {
                    const image = (
                      <img
                        src={badge.src}
                        alt={badge.alt}
                        loading="lazy"
                        decoding="async"
                        className="block w-auto"
                        style={{ height: badge.height ?? 20 }}
                      />
                    );
                    return badge.href ? (
                      <a
                        key={badge.src}
                        href={badge.href}
                        target="_blank"
                        rel="noreferrer"
                        className="transition-opacity hover:opacity-80"
                      >
                        {image}
                      </a>
                    ) : (
                      <span key={badge.src}>{image}</span>
                    );
                  })}
                </div>
              ))}
            </div>
          </Reveal>

          {/* Downloads: the browser extension's install button, which used to
              sit on the card search's empty state. */}
          <Reveal delay={400}>
            <div
              id="downloads"
              className="mt-8 flex flex-col items-center gap-3 scroll-mt-20"
              data-testid="downloads"
            >
              <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                Downloads
              </h2>
              <DownloadAppButton platform="chrome-extension" appId="noecbaibfhbmpapofcdkgchfifmoinfj" />
            </div>
          </Reveal>
        </div>
      </section>

      {tickerRows.length > 0 ? (
        <section className="relative py-6" aria-hidden>
          <div className="space-y-3">
            {tickerRows.map((row, index) => (
              <Marquee key={index} durationSeconds={index === 0 ? 48 : 56} reverse={index === 1}>
                {row.map((entry) => (
                  <span
                    key={entry.id}
                    className="da-chip rounded-full border border-border bg-card/70 px-4 py-1.5 text-sm whitespace-nowrap text-muted-foreground"
                  >
                    {entry.title}
                  </span>
                ))}
              </Marquee>
            ))}
          </div>
        </section>
      ) : null}

      <section
        id="showcase"
        aria-label="Workspaces"
        className="mx-auto max-w-6xl px-4 pt-6 pb-16 sm:px-6 lg:px-8"
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {README_SHOWCASE.map((workspace, index) => (
            <Reveal key={workspace.name} delay={index * 70}>
              <SpotlightCard className="h-full" hueShift={cardHueShift(index, hueOffset)}>
                <a
                  href={workspace.href}
                  className="group/workspace flex h-full flex-col items-center p-5 text-center"
                >
                  <img
                    src={workspace.image}
                    alt={`${workspace.name} — ${workspace.expansion}`}
                    loading="lazy"
                    decoding="async"
                    className="mb-4 aspect-square w-full max-w-[160px] object-contain"
                  />
                  <span className="text-sm font-semibold text-foreground transition-colors group-hover/workspace:text-[var(--da-card-accent,var(--da-accent))]">
                    {workspace.emoji} {workspace.name}
                  </span>
                  <span className="mt-1 text-[11px] leading-snug text-pretty text-muted-foreground">
                    {workspace.expansion}
                  </span>
                </a>
              </SpotlightCard>
            </Reveal>
          ))}
        </div>
      </section>

      {/* The tour video, between the workspace screenshots it walks through and
          the long-form sections below. */}
      <section
        id="tour"
        aria-label="Tour video"
        className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8"
      >
        <Reveal>
          <FeatureVideo />
        </Reveal>
      </section>

      {/* The CARDS overview and vision, moved here from `/research/cards`'s empty state. */}
      <section
        id="cards-vision"
        aria-label="CARDS vision"
        className="mx-auto max-w-6xl scroll-mt-20 px-4 pb-16 sm:px-6 lg:px-8"
      >
        <Reveal className="mx-auto mb-8 max-w-2xl text-center">
          <span className="da-accent-fill mb-4 inline-flex size-10 items-center justify-center rounded-xl">
            <Sparkles className="size-5" />
          </span>
          <h2 className="text-2xl font-semibold tracking-tight text-balance text-foreground">
            {CARDS_TITLE}
          </h2>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {CARDS_DOIS.map((doi) => (
              <a
                key={doi.href}
                href={doi.href}
                target="_blank"
                rel="noreferrer"
                className="transition-opacity hover:opacity-80"
              >
                <img src={doi.badge} alt="DOI" loading="lazy" decoding="async" className="h-5 w-auto" />
              </a>
            ))}
          </div>
        </Reveal>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Reveal>
            <SpotlightCard className="h-full">
              <div className="h-full p-6">
                <h3 className="mb-3 text-base font-semibold text-foreground">Overview</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{CARDS_OVERVIEW}</p>
              </div>
            </SpotlightCard>
          </Reveal>
          <Reveal delay={70}>
            <SpotlightCard className="h-full">
              <div className="h-full p-6">
                <h3 className="mb-3 text-base font-semibold text-foreground">Features &amp; Capabilities</h3>
                <ul className="list-disc space-y-2 pl-4 text-sm leading-relaxed text-muted-foreground">
                  {CARDS_CAPABILITIES.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </SpotlightCard>
          </Reveal>
        </div>

        <ol className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {CARDS_VISION.map((point, index) => (
            <Reveal key={point.title} as="li" delay={(index % 2) * 70}>
              <SpotlightCard className="h-full" hueShift={cardHueShift(index, hueOffset)}>
                <div className="h-full p-6">
                  <h3 className="mb-2 text-base font-semibold text-foreground">
                    <span className="mr-2 tabular-nums text-muted-foreground">{index + 1}.</span>
                    {point.title}
                  </h3>
                  {point.paragraphs.map((paragraph) => (
                    <p
                      key={paragraph}
                      className="mt-2 text-sm leading-relaxed text-muted-foreground first:mt-0"
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              </SpotlightCard>
            </Reveal>
          ))}
        </ol>
      </section>

      <section id="catalog" className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:px-8">
        {sections.length > 1 ? (
          <Reveal>
            <nav
              aria-label="Jump to a category"
              className="mb-10 flex flex-wrap justify-center gap-2"
            >
              {sections.map((section) => {
                const Icon = CATEGORY_ICONS[section.category];
                return (
                  <a
                    key={section.category}
                    href={`#${section.category}`}
                    className="da-chip inline-flex items-center gap-1.5 rounded-full border border-border bg-card/70 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur-sm"
                  >
                    <Icon className="size-3.5" />
                    {section.label}
                    <span className="tabular-nums opacity-60">({section.entries.length})</span>
                  </a>
                );
              })}
            </nav>
          </Reveal>
        ) : null}

        {sections.length === 0 ? (
          <EmptyState title={`No features match "${query}".`} />
        ) : (
          <div className="flex flex-col gap-16">
            {sections.map((section) => {
              const Icon = CATEGORY_ICONS[section.category];
              return (
                <section key={section.category} id={section.category} className="scroll-mt-20">
                  <Reveal className="mx-auto mb-8 max-w-2xl text-center">
                    <span className="da-accent-fill mb-4 inline-flex size-10 items-center justify-center rounded-xl">
                      <Icon className="size-5" />
                    </span>
                    <h2 className="text-2xl font-semibold tracking-tight text-balance text-foreground">
                      {section.label}
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-pretty text-muted-foreground">
                      {section.description}
                    </p>
                  </Reveal>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {section.entries.map((entry, index) => {
                      const docUrl = featureDocUrl(entry);
                      return (
                        <Reveal
                          key={entry.id}
                          // Stagger across the row, then restart — a long
                          // section shouldn't end up with a two-second delay
                          // on its last card.
                          delay={(index % 3) * 70}
                        >
                          <SpotlightCard className="h-full" hueShift={hueShifts.get(entry.id)}>
                            <div className="group/feature flex h-full flex-col p-5">
                              <div className="mb-2 flex items-center gap-2">
                                <span className="da-chip text-[10px] font-medium text-muted-foreground">
                                  {section.label}
                                </span>
                                {entry.tags && entry.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {entry.tags.slice(0, 3).map((tag) => (
                                      <span
                                        key={tag}
                                        className="da-chip text-[9px] font-medium text-muted-foreground/70 border-border/50"
                                      >
                                        {tag}
                                      </span>
                                    ))}
                                    {entry.tags.length > 3 && (
                                      <span className="da-chip text-[9px] font-medium text-muted-foreground/70 border-border/50">
                                        +{entry.tags.length - 3}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                              <a
                                href={entry.href}
                                className="text-sm font-semibold text-foreground transition-colors group-hover/feature:text-[var(--da-card-accent,var(--da-accent))]"
                              >
                                <span className="absolute inset-0" aria-hidden />
                                {entry.title}
                              </a>
                              <p className="mt-1.5 flex-1 text-xs leading-relaxed text-muted-foreground">
                                {entry.description}
                              </p>
                              {docUrl ? (
                                <a
                                  href={docUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground transition-colors hover:text-[var(--da-card-accent,var(--da-accent))]"
                                  aria-label={`Read docs for ${entry.title}`}
                                >
                                  <FileText className="size-3.5" />
                                  <span>Documentation</span>
                                </a>
                              ) : null}
                            </div>
                          </SpotlightCard>
                        </Reveal>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        <section id="documents" className="mt-16 scroll-mt-20">
          <Reveal className="mx-auto mb-8 max-w-2xl text-center">
            <span className="da-accent-fill mb-4 inline-flex size-10 items-center justify-center rounded-xl">
              <FileText className="size-5" />
            </span>
            <h2 className="text-2xl font-semibold tracking-tight text-balance text-foreground">
              Documents
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-pretty text-muted-foreground">
              PDF guides and handouts, straight from the shared Drive folder.
            </p>
          </Reveal>
          <Reveal>
            <DocumentsFolder />
          </Reveal>
        </section>
      </section>
    </div>
  );
}
