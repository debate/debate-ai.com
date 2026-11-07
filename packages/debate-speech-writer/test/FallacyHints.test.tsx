// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { FallacyHints } from "../src/ui/FallacyHints";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function renderText(text: string) {
  const container = document.createElement("div");
  await act(async () => {
    createRoot(container).render(<FallacyHints text={text} />);
  });
  return container;
}

describe("FallacyHints", () => {
  it("renders nothing for empty or clean text", async () => {
    expect((await renderText("")).innerHTML).toBe("");
    expect((await renderText("The study found a 12% drop in emissions.")).innerHTML).toBe("");
  });

  it("lists each finding with its label and count", async () => {
    const view = await renderText("You are a liar, so ignore the card.");
    expect(view.textContent).toContain("Possible fallacies (1)");
    expect(view.textContent).toContain("Ad hominem");
  });
});
