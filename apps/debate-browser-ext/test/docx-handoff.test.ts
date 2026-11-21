import { vi } from 'vitest';

vi.mock('wxt/browser', () => ({ browser: {} }));

import { describe, expect, it } from 'vitest';

import {
  DOCX_HANDOFF_MESSAGE,
  HANDOFF_TTL_MS,
  bytesToBase64,
  docxNameFromUrl,
  ensureDocxName,
  filenameFromContentDisposition,
  handleDocxHandoffMessage,
  isDocxHandoffMessage,
  parkDocx,
  pruneHandoffs,
  receiverUrl,
  type HandoffStorageArea,
} from '@/src/docx-import/handoff';
import { originPattern } from '@/src/docx-import/open-in-editor';

function memoryArea(): HandoffStorageArea & { data: Record<string, unknown> } {
  const data: Record<string, unknown> = {};
  return {
    data,
    async get(keys) {
      if (!keys) return { ...data };
      return Object.fromEntries(keys.filter((k) => k in data).map((k) => [k, data[k]]));
    },
    async set(items) {
      Object.assign(data, items);
    },
    async remove(keys) {
      for (const key of keys) delete data[key];
    },
  };
}

describe('docx-import/handoff', () => {
  it('names a file from its link', () => {
    expect(docxNameFromUrl('https://example.com/files/1AC%20Warming.docx?dl=1')).toBe('1AC Warming.docx');
    expect(docxNameFromUrl('https://example.com/')).toBe('Imported.docx');
    expect(ensureDocxName('a/b')).toBe('a-b.docx');
    expect(ensureDocxName('Case.DOCX')).toBe('Case.DOCX');
  });

  it('reads Content-Disposition', () => {
    expect(filenameFromContentDisposition('attachment; filename="Neg K.docx"')).toBe('Neg K.docx');
    expect(filenameFromContentDisposition("attachment; filename*=UTF-8''T%C3%A9st.docx")).toBe('Tést.docx');
    expect(filenameFromContentDisposition('inline')).toBeNull();
    expect(filenameFromContentDisposition(null)).toBeNull();
  });

  it('builds the receiver URL', () => {
    const url = new URL(
      receiverUrl('https://debate-ai.com/', { url: 'https://x.org/a.docx', name: 'a.docx', handoff: 'abcdef123' }),
    );
    expect(url.origin + url.pathname).toBe('https://debate-ai.com/import/docx');
    expect(url.searchParams.get('handoff')).toBe('abcdef123');
    expect(url.searchParams.get('url')).toBe('https://x.org/a.docx');
    expect(url.searchParams.get('name')).toBe('a.docx');
    expect(receiverUrl('https://debate-ai.com', { url: 'https://x.org/a.docx', name: 'a.docx' })).not.toContain(
      'handoff',
    );
  });

  it('asks only for the link\'s own site', () => {
    expect(originPattern('https://files.example.com:8443/a.docx?x=1')).toBe('https://files.example.com/*');
    expect(originPattern('file:///tmp/a.docx')).toBeNull();
    expect(originPattern('not a url')).toBeNull();
  });

  it('hands a parked file over exactly once', async () => {
    const area = memoryArea();
    const bytes = new Uint8Array([0x50, 0x4b, 3, 4, 255]);
    const id = await parkDocx(area, 'Case', bytes, { now: 1000, id: 'handoff-1234' });
    const message = { type: DOCX_HANDOFF_MESSAGE, op: 'take', id };
    expect(isDocxHandoffMessage(message)).toBe(true);

    const first = await handleDocxHandoffMessage(message, area, 2000);
    expect(first).toEqual({ ok: true, name: 'Case.docx', base64: bytesToBase64(bytes) });
    const second = await handleDocxHandoffMessage(message, area, 2000);
    expect(second.ok).toBe(false);
  });

  it('refuses bad requests and expired files', async () => {
    const area = memoryArea();
    expect((await handleDocxHandoffMessage({ type: DOCX_HANDOFF_MESSAGE, op: 'take', id: '../x' }, area)).ok).toBe(
      false,
    );
    const id = await parkDocx(area, 'Old.docx', new Uint8Array([1]), { now: 0, id: 'handoff-old1' });
    const late = await handleDocxHandoffMessage(
      { type: DOCX_HANDOFF_MESSAGE, op: 'take', id },
      area,
      HANDOFF_TTL_MS + 1,
    );
    expect(late.ok).toBe(false);
  });

  it('prunes stale handoffs and leaves other keys alone', async () => {
    const area = memoryArea();
    area.data['bulk:flows'] = 'keep';
    await parkDocx(area, 'a', new Uint8Array([1]), { now: 0, id: 'handoff-aaaa' });
    await pruneHandoffs(area, HANDOFF_TTL_MS + 1);
    expect(Object.keys(area.data)).toEqual(['bulk:flows']);
  });

  it('encodes large files without overflowing the stack', () => {
    const bytes = new Uint8Array(200_000).fill(65);
    expect(atob(bytesToBase64(bytes)).length).toBe(200_000);
  });
});
