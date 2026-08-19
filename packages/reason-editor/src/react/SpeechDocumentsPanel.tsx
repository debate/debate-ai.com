"use client";

/**
 * SpeechDocumentsPanel — renders every persisted speech document (see
 * `state/speechDocuments.ts`), closing the panel-UI half of follow-up (b)
 * under idea #14 ("Legacy Verbatim / Cardmirror Compatibility") in
 * TODO.md's Product Feature Ideas list: a place to view and manage what
 * the editor's "send selected evidence to a speech document" command
 * (`Mod-Shift-S` / the "→Speech" toolbar button) has sent, grouped by
 * document, each block removable individually.
 */

import { useState } from "react";

import type { SpeechDocument } from "../engine/speech-document.js";
import { buildSpeechDocumentText } from "../engine/speech-document.js";
import {
  deleteSpeechDocument,
  listSpeechDocuments,
  removeSpeechDocumentBlockAndSave,
} from "../state/speechDocuments.js";

export interface SpeechDocumentsPanelProps {
  className?: string;
}

export function SpeechDocumentsPanel({ className }: SpeechDocumentsPanelProps) {
  const [documents, setDocuments] = useState<SpeechDocument[]>(() => listSpeechDocuments());

  function refresh() {
    setDocuments(listSpeechDocuments());
  }

  function removeBlock(docId: string, blockId: string) {
    removeSpeechDocumentBlockAndSave(docId, blockId);
    refresh();
  }

  function removeDocument(docId: string) {
    deleteSpeechDocument(docId);
    refresh();
  }

  return (
    <div
      className={className ? `reason-editor-speech-documents ${className}` : "reason-editor-speech-documents"}
    >
      {documents.length === 0 ? (
        <p className="reason-editor-speech-documents-empty">
          No speech documents yet — send a selection from the editor
          (Ctrl/Cmd+Shift+S or the "→Speech" toolbar button) to start one.
        </p>
      ) : (
        <ul className="reason-editor-speech-documents-list">
          {documents.map((doc) => (
            <li key={doc.id} className="reason-editor-speech-documents-doc">
              <div className="reason-editor-speech-documents-doc-header">
                <h3>{doc.title}</h3>
                <button
                  type="button"
                  onClick={() => removeDocument(doc.id)}
                  aria-label={`Delete speech document "${doc.title}"`}
                >
                  Delete
                </button>
              </div>
              {doc.blocks.length === 0 ? (
                <p className="reason-editor-speech-documents-empty">No blocks yet.</p>
              ) : (
                <ol className="reason-editor-speech-documents-blocks">
                  {doc.blocks.map((block) => (
                    <li key={block.id} className="reason-editor-speech-documents-block">
                      {block.sourceLabel ? (
                        <span className="reason-editor-speech-documents-block-source">
                          {block.sourceLabel}
                        </span>
                      ) : null}
                      <p>{block.text}</p>
                      <button
                        type="button"
                        onClick={() => removeBlock(doc.id, block.id)}
                        aria-label="Remove block"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ol>
              )}
              <pre className="reason-editor-speech-documents-preview">{buildSpeechDocumentText(doc)}</pre>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
