/**
 * @fileoverview A small, fixed set of sample REASON editor documents
 * `components/reason-docs/FileTree.tsx` shows in place of the bare "No
 * documents yet." empty state when a signed-in user has no persisted
 * documents — the "REASON editor's file tree" follow-up TODO.md named as the
 * last open gap in its "sample mock data for empty states" ask, after
 * `MySavedItems` (`debate-round`), the Shared Evidence Library
 * (`debate-search-evidence`), and Practice Drills history
 * (`debate-practice-drills`) already got the same treatment.
 *
 * A tiny folder/file tree (one folder, two files) so a first-time visitor
 * sees what an organized file tree looks like before creating their own.
 * Negative ids keep these rows out of range of the real autoincrement
 * primary key (`lib/database/schema.ts`'s `documents.id` starts at 1), so a
 * real row can never collide with a sample one. Never persisted and never
 * returned by the `/api/doc/documents` fetch this package reads through
 * `ReasonDocsProvider` — `FileTree` renders this only when the caller's own
 * `documents` array is empty, not mixed into a real (possibly empty) result.
 *
 * @module lib/reason-docs/sample-documents
 */

import type { ReasonDocument } from "../../components/reason-docs/types"

export function getSampleReasonDocuments(): ReasonDocument[] {
  return [
    {
      id: -1,
      title: "Sample Case",
      content: "",
      format: "html",
      parentId: null,
      isFolder: true,
      updatedAt: 0,
    },
    {
      id: -2,
      title: "1AC — Warming Advantage",
      content: "",
      format: "html",
      parentId: -1,
      isFolder: false,
      updatedAt: 0,
    },
    {
      id: -3,
      title: "Neg Case Frontlines",
      content: "",
      format: "html",
      parentId: -1,
      isFolder: false,
      updatedAt: 0,
    },
  ]
}
