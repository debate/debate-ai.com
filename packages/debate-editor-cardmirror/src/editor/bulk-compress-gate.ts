/**
 * Bulk-compress feature gate. DORMANT BY DEFAULT.
 *
 * Bulk compress was a one-time remediation for the handful of
 * uncompressed early-alpha `.cmir` files. Those have long since been
 * migrated, so the tool is retired from the Home screen — but kept in
 * the build for the rare support case, reachable only by a deliberate
 * flip:
 *   - a manual `localStorage['pmd-compress'] = '1'` console flip (then
 *     reload), or
 *   - `VITE_COMPRESS=1` at vite build time.
 *
 * When the gate is closed the Home-screen Compress tile is hidden and
 * Quick Cards takes its place; the number-key shortcuts renumber around
 * the gap (see `home-screen.ts`).
 *
 * Zero heavy imports — consulted while assembling the Home screen.
 */

export function bulkCompressEnabled(): boolean {
  try {
    if ((import.meta as { env?: Record<string, string> }).env?.['VITE_COMPRESS'] === '1') {
      return true;
    }
  } catch {
    /* no import.meta.env outside vite */
  }
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem('pmd-compress') === '1';
  } catch {
    return false;
  }
}
