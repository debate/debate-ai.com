
import * as TabsComponents from 'fumadocs-ui/components/tabs';
import { File, Folder, Files } from 'fumadocs-ui/components/files';
import defaultComponents from 'fumadocs-ui/mdx';
import { APIPage } from './components/fumadocs/api/api-page';
import { FormatCard, FormatRules, RuleCard, RuleGrid } from './components/guides/debate-rules';
import { ExpandAllDetails } from './components/guides/expand-all-details';
import { CitationCard } from './components/guides/citation-card';
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
    CitationCard,
    ...components,
  };
}
