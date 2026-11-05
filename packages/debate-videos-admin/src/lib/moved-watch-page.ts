/**
 * Where a watch page should go after its video was edited.
 *
 * A video's address is built from its season, tournament, round and teams
 * (or title), so correcting one of those moves it. The page the edit was made
 * from follows it there, keeping whatever came after the video's own path —
 * the open speech and its view, e.g. `/2ar/outcomes`.
 *
 * @param currentPath - The page's path now (`window.location.pathname`).
 * @param previousHref - The video's canonical path before the save, or `null`.
 * @param href - The video's canonical path after the save, or `null`.
 * @returns The path to navigate to, or `null` to stay put (the address did
 *   not change, or the new one is unknown).
 */
export function movedWatchPagePath(
  currentPath: string,
  previousHref: string | null,
  href: string | null,
): string | null {
  if (!href) return null;
  const current = currentPath.replace(/\/+$/, "") || "/";
  const isUnder = (base: string) => current === base || current.startsWith(`${base}/`);

  let target = href;
  if (previousHref && previousHref !== href && isUnder(previousHref)) {
    target = `${href}${current.slice(previousHref.length)}`;
  } else if (isUnder(href)) {
    return null;
  }
  return target === current ? null : target;
}
