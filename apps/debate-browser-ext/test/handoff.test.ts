import { describe, expect, it } from 'vitest';

import { TOKEN_HASH_KEY, readTokenFromUrl } from '@/src/auth/handoff';

const BASE = 'https://debate-ai.com/auth/extension-complete';

describe('readTokenFromUrl', () => {
  it('reads the token the handoff page parked in the fragment', () => {
    expect(readTokenFromUrl(`${BASE}#${TOKEN_HASH_KEY}=abc123`)).toBe('abc123');
  });

  it('finds it alongside other fragment values', () => {
    expect(readTokenFromUrl(`${BASE}#state=x&${TOKEN_HASH_KEY}=abc123&other=y`)).toBe('abc123');
  });

  it('decodes a token that had to be escaped', () => {
    expect(readTokenFromUrl(`${BASE}#${TOKEN_HASH_KEY}=a%2Bb%3Dc`)).toBe('a+b=c');
  });

  it('waits rather than reporting a token the page has not set yet', () => {
    expect(readTokenFromUrl(`${BASE}`)).toBeNull();
    expect(readTokenFromUrl(`${BASE}#`)).toBeNull();
    expect(readTokenFromUrl(`${BASE}#${TOKEN_HASH_KEY}=`)).toBeNull();
    expect(readTokenFromUrl('https://debate-ai.com/login')).toBeNull();
    expect(readTokenFromUrl(undefined)).toBeNull();
  });

  it('ignores a token in the query string, which only the fragment carries', () => {
    // A query string reaches the server and its logs; the handoff deliberately
    // uses the fragment, so a token in `?` is not one this flow issued.
    expect(readTokenFromUrl(`${BASE}?${TOKEN_HASH_KEY}=abc123`)).toBeNull();
  });
});
