import { describe, expect, it } from 'vitest';

import { rewriteRemoteScripts } from '@/vite/no-remote-code';

// The URLs Chrome Web Store flagged in the 6.1.0 build.
const FLAGGED = [
  'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/mermaid/11.12.0/mermaid.min.js',
  'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1',
  'https://fast.wistia.com/assets/external/E-v1.js',
  'https://cdn.jsdelivr.net/npm/katex@0.16.47/dist/katex.min.js',
];

const installed: Record<string, string[]> = {
  jspdf: ['dist/jspdf.umd.min.js'],
  mermaid: ['dist/mermaid.min.js'],
  katex: ['dist/katex.min.js'],
};
const resolveFile = (pkg: string, file: string) =>
  installed[pkg]?.includes(file) ? `/repo/node_modules/${pkg}/${file}` : null;

describe('rewriteRemoteScripts', () => {
  it('leaves no remote script URL in the chunk', () => {
    const code = FLAGGED.map((url, i) => `s${i}.src="${url}";`).join('\n');
    const { code: out } = rewriteRemoteScripts(code, resolveFile);
    expect(out).not.toMatch(/https?:\/\//);
  });

  it('points npm CDN scripts at a copy of the installed package', () => {
    const { code, vendored, disabled } = rewriteRemoteScripts(
      `a="${FLAGGED[0]}";b=\`${FLAGGED[1]}\`;c='${FLAGGED[4]}'`,
      resolveFile
    );
    expect(code).toBe(
      `a="/vendor/jspdf/dist/jspdf.umd.min.js";b=\`/vendor/mermaid/dist/mermaid.min.js\`;c='/vendor/katex/dist/katex.min.js'`
    );
    expect([...vendored]).toEqual([
      ['vendor/jspdf/dist/jspdf.umd.min.js', '/repo/node_modules/jspdf/dist/jspdf.umd.min.js'],
      ['vendor/katex/dist/katex.min.js', '/repo/node_modules/katex/dist/katex.min.js'],
      ['vendor/mermaid/dist/mermaid.min.js', '/repo/node_modules/mermaid/dist/mermaid.min.js'],
    ]);
    expect(disabled).toEqual([]);
  });

  it('disables SDKs that have no npm build', () => {
    const { code, vendored, disabled } = rewriteRemoteScripts(
      `x("${FLAGGED[2]}");y("${FLAGGED[3]}")`,
      resolveFile
    );
    expect(code).toBe(
      'x("/vendor/unavailable/www.gstatic.com_cv_js_sender_v1_cast_sender.js");' +
        'y("/vendor/unavailable/fast.wistia.com_assets_external_E-v1.js")'
    );
    expect(vendored.size).toBe(0);
    expect(disabled).toEqual([FLAGGED[2], FLAGGED[3]]);
  });

  it('disables an npm CDN script whose package is not installed', () => {
    const { code, disabled } = rewriteRemoteScripts(
      '"https://unpkg.com/@scope/pkg@1.0.0/index.js"',
      resolveFile
    );
    expect(code).toBe('"/vendor/unavailable/unpkg.com_scope_pkg_1.0.0_index.js"');
    expect(disabled).toHaveLength(1);
  });

  it('leaves non-script URLs alone', () => {
    const code =
      '"https://debate-ai.com/api/x";"https://example.com/data.json";"https://vuejs.org/";"https://cdn.jsdelivr.net/npm/katex@0.16.47/dist/katex.min.css"';
    expect(rewriteRemoteScripts(code, resolveFile).code).toBe(code);
  });
});
