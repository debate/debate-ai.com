/**
 * @file dev-search-route.ts
 * @description Search index for the developer docs only, mounted by the web
 * app at `app/docs/dev/api/search/route.ts`. The search dialog asks this one
 * instead of `/docs/api/docs-search` while a /docs/dev page is open, so the
 * two sites' search results never mix.
 */
import { devSource } from '../lib/fumadocs/dev-source';
import { createFromSource } from 'fumadocs-core/search/server';

export const revalidate = false;

export const { staticGET: GET } = createFromSource(devSource);
