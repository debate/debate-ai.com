import { describe, expect, it } from 'vitest';
import {
  BULK_STORAGE_MESSAGE,
  KEY_PREFIX,
  handleBulkStorageMessage,
  isBulkStorageMessage,
  type BridgeStorageArea,
} from '../src/storage/bulk-storage-bridge';

function area() {
  const data = new Map<string, unknown>();
  const storage: BridgeStorageArea = {
    async get(keys) {
      return Object.fromEntries(keys.filter((k) => data.has(k)).map((k) => [k, data.get(k)]));
    },
    async set(items) {
      for (const [k, v] of Object.entries(items)) data.set(k, v);
    },
    async remove(keys) {
      for (const k of keys) data.delete(k);
    },
  };
  return { storage, data };
}

const msg = (body: Record<string, unknown>) => ({ type: BULK_STORAGE_MESSAGE, ...body });

describe('bulk storage bridge', () => {
  it('recognises only its own messages', () => {
    expect(isBulkStorageMessage(msg({ op: 'ping' }))).toBe(true);
    expect(isBulkStorageMessage({ type: 'other' })).toBe(false);
    expect(isBulkStorageMessage(undefined)).toBe(false);
  });

  it('answers a ping as unlimited', async () => {
    expect(await handleBulkStorageMessage(msg({ op: 'ping' }), area().storage)).toEqual({
      ok: true,
      unlimited: true,
    });
  });

  it('stores, reads and removes values under its prefix', async () => {
    const { storage, data } = area();
    expect((await handleBulkStorageMessage(msg({ op: 'set', key: 'flows', value: '[1]' }), storage)).ok).toBe(true);
    expect(data.get(`${KEY_PREFIX}flows`)).toBe('[1]');
    expect(await handleBulkStorageMessage(msg({ op: 'get', keys: ['flows', 'rounds'] }), storage)).toEqual({
      ok: true,
      values: { flows: '[1]', rounds: null },
    });
    await handleBulkStorageMessage(msg({ op: 'remove', key: 'flows' }), storage);
    expect(data.size).toBe(0);
  });

  it("refuses keys outside the site's store", async () => {
    const { storage, data } = area();
    const response = await handleBulkStorageMessage(msg({ op: 'set', key: 'toolbarAction', value: 'x' }), storage);
    expect(response.ok).toBe(false);
    expect(data.size).toBe(0);
    expect(await handleBulkStorageMessage(msg({ op: 'get', keys: ['toolbarAction'] }), storage)).toEqual({
      ok: true,
      values: {},
    });
  });

  it('reports a storage failure instead of throwing', async () => {
    const failing: BridgeStorageArea = {
      get: async () => {
        throw new Error('boom');
      },
      set: async () => {},
      remove: async () => {},
    };
    expect(await handleBulkStorageMessage(msg({ op: 'get', keys: ['flows'] }), failing)).toEqual({
      ok: false,
      error: 'boom',
    });
  });
});
