/**
 * Render test for `ArgumentTagPopover`, the overlay the flow grid's "Tag
 * Argument…" context-menu entry opens. As in `PrepNoteBadge.test.tsx`, the
 * Vitest environment is `node`, so this renders through `react-dom/server`
 * and asserts on the markup. The component clamps its own position against
 * the viewport during render, so `window` is stubbed for these tests.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { ArgumentTagPopover } from "../src/flow/ArgumentTagPopover";

beforeEach(() => {
  vi.stubGlobal("window", { innerWidth: 1200, innerHeight: 800 });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ArgumentTagPopover", () => {
  it("offers every argument type and evidence status, plus a None option for each", () => {
    const markup = renderToStaticMarkup(
      <ArgumentTagPopover
        x={100}
        y={100}
        tags={{}}
        authorIdSuggestions={[]}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    for (const type of ["contention", "link", "impact", "turn", "answer", "extension"]) {
      expect(markup).toContain(`>${type}</option>`);
    }
    for (const status of ["cited", "contested", "unverified"]) {
      expect(markup).toContain(`>${status}</option>`);
    }
    expect(markup.match(/>None<\/option>/g)).toHaveLength(2);
  });

  it("seeds the form from the row's existing tags", () => {
    const markup = renderToStaticMarkup(
      <ArgumentTagPopover
        x={100}
        y={100}
        tags={{ argumentType: "turn", authorId: "alex", evidenceStatus: "contested" }}
        authorIdSuggestions={["alex", "sam"]}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(markup).toContain('value="turn" selected');
    expect(markup).toContain('value="contested" selected');
    expect(markup).toContain('value="alex"');
  });

  it("renders the contributor suggestions as a datalist the input points at", () => {
    const markup = renderToStaticMarkup(
      <ArgumentTagPopover
        x={100}
        y={100}
        tags={{}}
        authorIdSuggestions={["alex", "sam"]}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(markup).toContain('list="flow-argument-author-ids"');
    expect(markup).toContain('<datalist id="flow-argument-author-ids">');
    expect(markup).toContain('value="sam"');
  });

  it("renders no section block when there are no neighbouring rows", () => {
    const markup = renderToStaticMarkup(
      <ArgumentTagPopover
        x={100}
        y={100}
        tags={{}}
        authorIdSuggestions={[]}
        sectionRows={[]}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(markup).not.toContain("Other rows in this section");
  });

  it("lists neighbouring section rows with their content and tags, plus a bulk-apply checkbox", () => {
    const markup = renderToStaticMarkup(
      <ArgumentTagPopover
        x={100}
        y={100}
        tags={{}}
        authorIdSuggestions={[]}
        sectionRows={[
          { rowIndex: 2, label: "Impact", tags: { argumentType: "impact", authorId: "sam" } },
          { rowIndex: 3, label: "Uniqueness", tags: {} },
        ]}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(markup).toContain("Other rows in this section");
    expect(markup).toContain("Impact");
    expect(markup).toContain("impact · sam");
    expect(markup).toContain("Uniqueness");
    expect(markup).toContain("—");
    expect(markup).toContain("Also tag these 2 rows");
    expect(markup).toContain('type="checkbox"');
  });

  it("clamps its position so it stays inside the viewport", () => {
    const markup = renderToStaticMarkup(
      <ArgumentTagPopover
        x={5000}
        y={5000}
        tags={{}}
        authorIdSuggestions={[]}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(markup).toContain("left:932px");
    expect(markup).toContain("top:532px");
  });
});
