/**
 * PDF rendering of the keyboard-shortcuts reference — a third "save the
 * full reference" action alongside Export…'s `.txt` file (see
 * `reference-export.ts`) and Print's browser print dialog (see
 * `reference-ui.ts`), for a user who wants a portable, already-paginated
 * file without going through their own browser's print-to-PDF flow.
 *
 * Kept separate from `reference-ui.ts` (DOM/overlay code) so the layout
 * logic — the part worth covering with a fast test — doesn't drag the
 * modal's DOM-building/overlay-lifecycle code along with it, mirroring
 * how `reference-export.ts` is split out for the same reason.
 */

import { PDFDocument, PageSizes, StandardFonts } from 'pdf-lib';
import type { ShortcutsReferenceGroup } from './reference-export.js';

const EM_DASH = '—';
const MARGIN = 50;
const KEY_COLUMN_WIDTH = 170;
const TITLE_SIZE = 18;
const GROUP_TITLE_SIZE = 13;
const ROW_SIZE = 10.5;
const LINE_GAP = 6;

/**
 * Renders the reference as a paginated PDF: a title, then one heading
 * per non-empty group with its rows laid out in two columns (key,
 * label) underneath. Matches the on-screen modal's content exactly —
 * same groups/rows, no search filter applied (an export/print is
 * always the full reference, same convention as `formatShortcutsReferenceText`).
 */
export async function buildShortcutsReferencePdf(
  groups: ShortcutsReferenceGroup[],
): Promise<Uint8Array> {
  const nonEmpty = groups.filter((g) => g.rows.length > 0);

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
  const [pageWidth, pageHeight] = PageSizes.Letter;

  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - MARGIN;

  // Starts a fresh page once the next block of `needed` height would
  // run past the bottom margin, so a group's heading never gets
  // stranded alone at the foot of a page with its rows pushed over.
  const ensureRoom = (needed: number): void => {
    if (y - needed < MARGIN) {
      page = doc.addPage([pageWidth, pageHeight]);
      y = pageHeight - MARGIN;
    }
  };

  page.drawText('Keyboard shortcuts', {
    x: MARGIN,
    y,
    size: TITLE_SIZE,
    font: boldFont,
  });
  y -= TITLE_SIZE + LINE_GAP * 2;

  for (const group of nonEmpty) {
    ensureRoom(GROUP_TITLE_SIZE + LINE_GAP + ROW_SIZE);
    page.drawText(group.title, {
      x: MARGIN,
      y,
      size: GROUP_TITLE_SIZE,
      font: boldFont,
    });
    y -= GROUP_TITLE_SIZE + LINE_GAP;

    for (const row of group.rows) {
      ensureRoom(ROW_SIZE + LINE_GAP);
      page.drawText(row.keyText || EM_DASH, {
        x: MARGIN,
        y,
        size: ROW_SIZE,
        font,
      });
      page.drawText(row.label, {
        x: MARGIN + KEY_COLUMN_WIDTH,
        y,
        size: ROW_SIZE,
        font,
      });
      y -= ROW_SIZE + LINE_GAP;
    }
    y -= LINE_GAP;
  }

  return doc.save();
}
