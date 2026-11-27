/** @vitest-environment jsdom */
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import {
  REFERENCE_SUGGESTIONS_ENDPOINT,
  ReferenceQuoteLegend,
  ReferenceQuoteStatus,
} from "../components/guides/reference-quote-status";
import { TooltipProvider } from "../components/ui/tooltip";

const HREF = "/docs/journal/synergy-slayer-critiques/references#ref-ackerman-2020";
const TITLE = "Ackerman, Elliot, et al. “A Letter on Justice and Open Debate.”";
const TEXT = "Change comes from power, and power comes from organized people acting together over time.";

let root: Root | null = null;
let container: HTMLElement | null = null;

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
});

afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

async function mount(ui: ReactNode) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root!.render(<TooltipProvider>{ui}</TooltipProvider>));
}

const iconFor = (status: string) => document.querySelector<HTMLElement>(`[data-reference-quote-status="${status}"]`);
const dialog = () => document.querySelector<HTMLElement>("[data-reference-suggestion-dialog]");

async function type(element: HTMLTextAreaElement | HTMLInputElement, value: string) {
  const proto = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("ReferenceQuoteStatus icons", () => {
  it("shows a distinct icon per status, and a button only where text can be suggested", async () => {
    await mount(
      <>
        {["underlined", "full", "ellipses", "missing"].map((status) => (
          <ReferenceQuoteStatus key={status} href={HREF} status={status} title={TITLE} />
        ))}
      </>,
    );
    const icons = Object.fromEntries(
      ["underlined", "full", "ellipses", "missing"].map((s) => [s, iconFor(s)!]),
    );
    expect(icons.underlined!.tagName).toBe("SPAN");
    expect(icons.full!.tagName).toBe("SPAN");
    expect(icons.ellipses!.tagName).toBe("BUTTON");
    expect(icons.missing!.tagName).toBe("BUTTON");

    const shapes = Object.values(icons).map((el) => el.querySelector("svg")?.getAttribute("class"));
    expect(new Set(shapes.map((c) => c?.match(/lucide-[a-z-]+/)?.[0])).size).toBe(4);
    expect(icons.missing!.className).toContain("text-red-600");
    expect(icons.missing!.getAttribute("aria-label")).toContain("suggest the full text");
    expect(icons.underlined!.getAttribute("aria-label")).toBe("Full text, underlined");
  });

  it("renders nothing for an unknown status", async () => {
    await mount(<ReferenceQuoteStatus href={HREF} status="bogus" />);
    expect(document.querySelector("[data-reference-quote-status]")).toBeNull();
  });

  it("explains each icon in the legend", async () => {
    await mount(<ReferenceQuoteLegend />);
    const text = document.body.textContent ?? "";
    for (const label of ["Full text, underlined", "Full text", "Only ellipses", "Text missing"]) expect(text).toContain(label);
    expect(document.querySelectorAll("[role=listitem]")).toHaveLength(4);
  });
});

describe("suggesting the full text", () => {
  it("opens from the red X without folding the entry, and posts the suggestion", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await mount(
      <details open>
        <summary>
          Ackerman <ReferenceQuoteStatus href={HREF} status="missing" title={TITLE} />
        </summary>
        body
      </details>,
    );

    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    await act(async () => iconFor("missing")!.dispatchEvent(click));
    expect(click.defaultPrevented).toBe(true);
    expect(dialog()).not.toBeNull();
    expect(dialog()!.textContent).toContain("Suggest the full text");
    expect(dialog()!.textContent).toContain(TITLE);

    const submit = [...dialog()!.querySelectorAll("button")].find((b) => b.textContent === "Send suggestion")!;
    expect(submit.disabled).toBe(true);

    await type(dialog()!.querySelector<HTMLTextAreaElement>("textarea")!, TEXT);
    expect(dialog()!.textContent).not.toContain("Your name");
    expect(dialog()!.textContent).not.toContain("Note");
    expect(dialog()!.querySelectorAll("textarea")).toHaveLength(1);
    expect(dialog()!.querySelectorAll("input:not([name=website])")).toHaveLength(0);
    expect(submit.disabled).toBe(false);

    await act(async () => submit.click());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(REFERENCE_SUGGESTIONS_ENDPOINT);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      page: "/docs/journal/synergy-slayer-critiques/references",
      refId: "ref-ackerman-2020",
      title: TITLE,
      text: TEXT,
      website: "",
    });
    expect(dialog()!.textContent).toContain("Thank you");
  });

  it("shows the server's message when the suggestion is refused", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "You can send more in 1 hour." }), { status: 429 })),
    );
    await mount(<ReferenceQuoteStatus href={HREF} status="ellipses" title={TITLE} />);
    await act(async () => iconFor("ellipses")!.click());
    await type(dialog()!.querySelector<HTMLTextAreaElement>("textarea")!, TEXT);
    await act(async () => [...dialog()!.querySelectorAll("button")].find((b) => b.textContent === "Send suggestion")!.click());
    expect(dialog()!.querySelector("[role=alert]")?.textContent).toBe("You can send more in 1 hour.");
    expect(dialog()!.textContent).not.toContain("Thank you");
  });

  it("does nothing for an icon whose link is not a reference anchor", async () => {
    await mount(<ReferenceQuoteStatus href="/docs/journal/x/references" status="missing" title={TITLE} />);
    expect(iconFor("missing")!.tagName).toBe("SPAN");
  });
});
