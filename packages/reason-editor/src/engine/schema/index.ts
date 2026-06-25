/**
 * The CardMirror schema.
 *
 * Top-level export. See ARCHITECTURE.md §4 for the design rationale,
 * NOTES-verbatim.md for the docx data model this schema is shaped to
 * round-trip with.
 */

import { Schema } from 'prosemirror-model';
import { nodes } from './nodes.js';
import { marks } from './marks.js';

export const schema = new Schema({ nodes, marks });

export { nodes } from './nodes.js';
export { marks } from './marks.js';
export {
  newHeadingId,
  bookmarkNameForId,
  idFromBookmarkName,
  HEADING_BOOKMARK_PREFIX,
} from './ids.js';
