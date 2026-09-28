/**
 * @file search-route.ts
 * @description API route for documentation search using Orama, mounted by
 * the web app at `app/docs/api/docs-search/route.ts`. It returns the whole
 * index for the search dialog to query in the browser (`type: 'static'`).
 */
import { source } from '../lib/fumadocs/source';
import { createFromSource } from 'fumadocs-core/search/server';

// it should be cached forever
export const revalidate = false;

export const { staticGET: GET } = createFromSource(source);