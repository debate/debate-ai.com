/** Where a listing's page lives. */
export function listingHref(id: string): string {
  return `/research/market/${encodeURIComponent(id)}`
}
