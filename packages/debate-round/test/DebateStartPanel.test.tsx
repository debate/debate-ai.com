/** Render test for `DebateStartPanel`'s host-supplied header slot (node env, `react-dom/server` markup). */

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { DebateStartPanel } from "../src/panels/DebateStartPanel";

const noop = () => {};

const render = (headerActions?: React.ReactNode) =>
  renderToStaticMarkup(
    <DebateStartPanel
      rounds={[]}
      history={[]}
      pinnedIds={[]}
      onOpenRound={noop}
      onOpenHistoryEntry={noop}
      onTogglePin={noop}
      onCreateFlow={noop}
      onCreateRound={noop}
      onOpenHistory={noop}
      headerActions={headerActions}
    />,
  );

describe("DebateStartPanel headerActions", () => {
  it("renders the host's controls in the header, before the New flow button", () => {
    const html = render(<span data-testid="sync-badge">Saved to your account</span>);
    expect(html).toContain('data-testid="sync-badge"');
    expect(html.indexOf("sync-badge")).toBeLessThan(html.indexOf("New flow"));
  });

  it("renders the header unchanged when no controls are supplied", () => {
    const html = render();
    expect(html).toContain("Debate FIAT");
    expect(html).toContain("New flow");
    expect(html).not.toContain("sync-badge");
  });
});
