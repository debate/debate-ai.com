import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { FileTree } from "../../../src/components/reason-docs/FileTree";
import type { ReasonDocument } from "../../../src/components/reason-docs/types";

const noop = () => {};

describe("FileTree", () => {
  it("shows a badged sample file tree under the empty-state message when there are no documents", () => {
    const html = renderToStaticMarkup(
      <FileTree
        documents={[]}
        activeId={null}
        onSelect={noop}
        onAdd={noop}
        onRename={noop}
        onDelete={noop}
        onMove={noop}
      />,
    );

    expect(html).toContain("No documents yet.");
    expect(html).toContain("Sample");
    expect(html).toContain("Sample Case");
  });

  it("does not show sample rows once a real document exists", () => {
    const documents: ReasonDocument[] = [
      { id: 1, title: "My Case", content: "", format: "html", parentId: null, isFolder: false, updatedAt: 0 },
    ];

    const html = renderToStaticMarkup(
      <FileTree
        documents={documents}
        activeId={null}
        onSelect={noop}
        onAdd={noop}
        onRename={noop}
        onDelete={noop}
        onMove={noop}
      />,
    );

    expect(html).toContain("My Case");
    expect(html).not.toContain("No documents yet.");
    expect(html).not.toContain("Sample Case");
    expect(html).not.toContain(">Sample<");
  });
});
