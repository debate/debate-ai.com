
import * as TabsComponents from 'fumadocs-ui/components/tabs';
import { File, Folder, Files } from 'fumadocs-ui/components/files';
import defaultComponents from 'fumadocs-ui/mdx';
import { APIPage } from './components/fumadocs/api/api-page';
import { FormatCard, FormatRules, RuleCard, RuleGrid } from './components/guides/debate-rules';
import { ExpandAllDetails } from './components/guides/expand-all-details';
import { MovedAnchors } from './components/guides/moved-anchors';
import { CitationCard } from './components/guides/citation-card';
import { ReferenceQuoteLegend, ReferenceQuoteStatus } from './components/guides/reference-quote-status';
import { CitationStyleSwitcher } from './components/guides/citation-style-switcher';
import { BibleCitation, BibleQuote } from './components/guides/bible-citation';
import { JournalMasthead } from './components/guides/journal-masthead';
import type { MDXComponents } from 'mdx/types';
// make sure you can use it in MDX files


export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...TabsComponents,
    ...defaultComponents,
    // @ts-ignore
    APIPage,
    File,
    Folder,
    Files,
    FormatCard,
    FormatRules,
    RuleCard,
    RuleGrid,
    ExpandAllDetails,
    MovedAnchors,
    CitationCard,
    CitationStyleSwitcher,
    ReferenceQuoteLegend,
    ReferenceQuoteStatus,
    BibleCitation,
    BibleQuote,
    JournalMasthead,
    ...components,
  };
}
