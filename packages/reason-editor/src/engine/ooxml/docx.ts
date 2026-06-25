/**
 * .docx zip read/write helpers.
 *
 * A .docx is a zip with a specific file layout:
 *   [Content_Types].xml          — declares MIME types per part
 *   _rels/.rels                  — top-level relationships
 *   word/document.xml            — the actual document content
 *   word/styles.xml              — style definitions
 *   word/_rels/document.xml.rels — document part relationships
 *   word/settings.xml            — editor settings
 *   word/fontTable.xml           — fonts referenced
 *   word/webSettings.xml, etc.   — optional
 *
 * For our v0 we emit a minimal but valid set: document.xml + styles.xml +
 * the boilerplate Content_Types + rels files. Anything more elaborate
 * (themes, fonts, settings) we copy through if present in an input zip
 * but don't generate from scratch.
 */

import JSZip from 'jszip';
import { CANONICAL_STYLES_XML } from './styles.js';
import { XML_PROLOG, escText } from './xml.js';

/** Loaded docx — an in-memory zip we can read parts from and modify. */
export class Docx {
  constructor(private zip: JSZip) {}

  /** Load a .docx from a Uint8Array (Node Buffer / browser ArrayBuffer-derived). */
  static async load(bytes: Uint8Array | ArrayBuffer): Promise<Docx> {
    const zip = await JSZip.loadAsync(bytes);
    return new Docx(zip);
  }

  /** Construct a fresh, minimal .docx with the canonical style block. */
  static empty(): Docx {
    const zip = new JSZip();
    zip.file('[Content_Types].xml', CONTENT_TYPES_XML);
    zip.file('_rels/.rels', TOP_LEVEL_RELS_XML);
    zip.file('word/styles.xml', CANONICAL_STYLES_XML);
    zip.file('word/_rels/document.xml.rels', DOCUMENT_RELS_XML);
    zip.file('word/document.xml', EMPTY_DOCUMENT_XML);
    // Verbatim-recognition surface. Setting <w:attachedTemplate> in
    // word/settings.xml with a Target ending in "/Debate.dotm" makes
    // Verbatim's per-doc visibility callback
    // (Ribbon.GetRibbonVisibility, registered on every group in
    // customUI14.xml) return True, so the Debate ribbon activates
    // when a Verbatim user opens our export — without them having
    // to click "Verbatimize" first. Verified by experiment to be
    // sufficient: Word doesn't validate the file exists at the
    // stored path, it just basename-matches the URI. Both Windows
    // and Mac Verbatim installs read the same XML shape and
    // activate identically. The methodology (extract Verbatimize'd
    // doc, diff against unverbatimized, narrow the recognition
    // surface, sweep URI shapes to pick the most portable Target)
    // lives in `reference-docs/experiment-verbatimize.mjs`
    // (gitignored — local diagnostic for re-running if Verbatim's
    // recognition mechanism ever shifts).
    zip.file('word/settings.xml', SETTINGS_XML);
    zip.file('word/_rels/settings.xml.rels', SETTINGS_RELS_XML);
    return new Docx(zip);
  }

  /** Read a part as a string. */
  async readText(path: string): Promise<string | null> {
    const file = this.zip.file(path);
    if (!file) return null;
    return file.async('string');
  }

  /** Write or overwrite a part. */
  writeText(path: string, content: string): void {
    this.zip.file(path, content);
  }

  /** Read a part as raw bytes. */
  async readBinary(path: string): Promise<Uint8Array | null> {
    const file = this.zip.file(path);
    if (!file) return null;
    return file.async('uint8array');
  }

  /** Write or overwrite a binary part. */
  writeBinary(path: string, bytes: Uint8Array): void {
    this.zip.file(path, bytes);
  }

  /** Insert one or more `<Override>` entries into the
   *  `[Content_Types].xml` part. Used by `toDocx` to declare any
   *  optional parts beyond the baseline (comments.xml,
   *  commentsExtended.xml, etc.). */
  async addContentTypeOverrides(overrides: { partName: string; contentType: string }[]): Promise<void> {
    if (overrides.length === 0) return;
    const ct = await this.readText('[Content_Types].xml');
    if (!ct) return;
    const additions = overrides
      .map((o) => `<Override PartName="${o.partName}" ContentType="${o.contentType}"/>`)
      .join('');
    const updated = ct.replace('</Types>', `${additions}</Types>`);
    this.writeText('[Content_Types].xml', updated);
  }

  /** Write the CardMirror `docId` as a custom document property
   *  (`docProps/custom.xml`) — verified to survive a real Word round-trip.
   *  Adds the part, its content-type override, and a package relationship.
   *  Idempotent-ish: if a custom.xml already exists we replace it (we only
   *  store the one property). When a `custom.xml` already exists we MERGE
   *  into it — preserving any other custom properties the user/Word set —
   *  rather than overwriting the whole part. */
  async writeDocId(docId: string): Promise<void> {
    const prop = (pid: number): string =>
      `<property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="${pid}" name="cmirDocId"><vt:lpwstr>${escText(docId)}</vt:lpwstr></property>`;
    const existing = await this.readText('docProps/custom.xml');
    let propsXml: string;
    if (existing && existing.includes('<Properties')) {
      // Drop any prior cmirDocId, then append ours with a fresh pid that
      // doesn't collide with the surviving properties' pids.
      const stripped = existing.replace(
        /<property\b[^>]*\bname="cmirDocId"[^>]*>[\s\S]*?<\/property>/,
        '',
      );
      const pids = [...stripped.matchAll(/\bpid="(\d+)"/g)].map((m) => Number(m[1]));
      const nextPid = (pids.length ? Math.max(...pids) : 1) + 1;
      propsXml = stripped.replace('</Properties>', `${prop(nextPid)}</Properties>`);
    } else {
      propsXml = `${XML_PROLOG}
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">${prop(2)}</Properties>`;
    }
    this.writeText('docProps/custom.xml', propsXml);

    const ct = await this.readText('[Content_Types].xml');
    if (ct && !ct.includes('docProps/custom.xml')) {
      this.writeText(
        '[Content_Types].xml',
        ct.replace(
          '</Types>',
          '<Override PartName="/docProps/custom.xml" ContentType="application/vnd.openxmlformats-officedocument.custom-properties+xml"/></Types>',
        ),
      );
    }

    const rels = await this.readText('_rels/.rels');
    if (rels && !rels.includes('custom-properties')) {
      const ids = [...rels.matchAll(/Id="rId(\d+)"/g)].map((m) => Number(m[1]));
      const nextId = `rId${(ids.length ? Math.max(...ids) : 0) + 1}`;
      this.writeText(
        '_rels/.rels',
        rels.replace(
          '</Relationships>',
          `<Relationship Id="${nextId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/custom-properties" Target="docProps/custom.xml"/></Relationships>`,
        ),
      );
    }
  }

  /** Read the CardMirror `docId` custom property, or null if absent. */
  async readDocId(): Promise<string | null> {
    const xml = await this.readText('docProps/custom.xml');
    if (!xml) return null;
    const m = xml.match(/name="cmirDocId"[^>]*>\s*<vt:lpwstr>([^<]*)<\/vt:lpwstr>/);
    return m ? m[1]! : null;
  }

  /** Get the raw zip for advanced operations. */
  raw(): JSZip {
    return this.zip;
  }

  /** Serialize to bytes (for writing to disk or sending across a wire). */
  async toBuffer(): Promise<Uint8Array> {
    return this.zip.generateAsync({
      type: 'uint8array',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });
  }

  /** List all part paths in the zip. */
  paths(): string[] {
    const paths: string[] = [];
    this.zip.forEach((path) => {
      paths.push(path);
    });
    return paths;
  }
}

// -------- Boilerplate XML for fresh docx --------

const CONTENT_TYPES_XML = `${XML_PROLOG}
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Default Extension="jpg" ContentType="image/jpeg"/>
  <Default Extension="jpeg" ContentType="image/jpeg"/>
  <Default Extension="gif" ContentType="image/gif"/>
  <Default Extension="bmp" ContentType="image/bmp"/>
  <Default Extension="svg" ContentType="image/svg+xml"/>
  <Default Extension="webp" ContentType="image/webp"/>
  <Default Extension="tif" ContentType="image/tiff"/>
  <Default Extension="tiff" ContentType="image/tiff"/>
  <Default Extension="emf" ContentType="image/x-emf"/>
  <Default Extension="wmf" ContentType="image/x-wmf"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
</Types>`;

const TOP_LEVEL_RELS_XML = `${XML_PROLOG}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const DOCUMENT_RELS_XML = `${XML_PROLOG}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

const EMPTY_DOCUMENT_XML = `${XML_PROLOG}
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="w14">
  <w:body>
    <w:p/>
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

// `word/settings.xml` — minimum Verbatim-recognition payload: a
// single <w:attachedTemplate> element. The r:id resolves against
// `word/_rels/settings.xml.rels` (NOT document.xml.rels — that's a
// common confusion, and was the bug in the v6/v7 experiment).
const SETTINGS_XML = `${XML_PROLOG}
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:attachedTemplate r:id="rId1"/>
</w:settings>`;

// `word/_rels/settings.xml.rels` — Verbatim's `GetRibbonVisibility`
// callback checks `ActiveDocument.AttachedTemplate.Name`. Word
// reads the basename of the Target URI for this property; it
// doesn't validate that a file actually exists at the path. So a
// minimal URI ending in `/Debate.dotm` makes the recognition check
// pass on any user's machine, regardless of where (or whether)
// they have Debate.dotm installed. `TargetMode="External"` tells
// Word the Target is a file-system reference, not an in-package
// part.
const SETTINGS_RELS_XML = `${XML_PROLOG}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/attachedTemplate" Target="file:///Debate.dotm" TargetMode="External"/></Relationships>`;
