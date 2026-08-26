/**
 * The blank document New creates — exactly one empty paragraph, shared
 * by single-pane and the three-pane shell so the two modes cannot
 * drift. Pocket seeding is a speech-doc-only, setting-gated affordance
 * (`makeSpeechBlankDoc` behind "Seed new speech docs with a Pocket
 * heading"); a plain New must not grow headings — the pane chip / window
 * title already carry the doc's name, and the speech path's pocket-OFF
 * cursor math assumes position 1 is inside the only paragraph.
 */
import type { Node as PMNode } from 'prosemirror-model';
import { schema } from '../schema/index.js';

export function makeBlankDoc(): PMNode {
  return schema.nodes['doc']!.createChecked(null, [
    schema.nodes['paragraph']!.create(),
  ]);
}
