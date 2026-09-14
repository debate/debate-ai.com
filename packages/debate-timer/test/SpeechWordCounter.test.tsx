// @vitest-environment jsdom
/**
 * @fileoverview Covers SpeechWordCounter, the word-limit counterpart to the
 * speech countdown. In word-limit mode this readout is what tells a speaker how
 * much of their speech is left, so the count, the warning thresholds, and the
 * editable popover are what these tests pin.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SpeechWordCounter } from "../src/timers/SpeechWordCounter";
import { click, mount, type } from "./helpers/mount";

const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(" ");

const triggerOf = (container: HTMLElement) =>
  container.querySelector("button") as HTMLButtonElement;
/** Popover content is portalled to the body, not the mount container. */
const contentOf = () =>
  document.body.querySelector("[data-slot=popover-content]") as HTMLElement | null;

const props = (overrides: Record<string, unknown> = {}) =>
  ({
    speechName: "1AC",
    wordLimit: 100,
    text: "",
    onTextChange: vi.fn(),
    ...overrides,
  }) as Parameters<typeof SpeechWordCounter>[0];

beforeEach(() => {
  delete (window as unknown as Record<string, unknown>).SpeechRecognition;
  delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SpeechWordCounter readout", () => {
  it("shows the running count against the limit", async () => {
    const view = await mount(
      <SpeechWordCounter {...props({ text: words(12) })} />,
    );
    expect(triggerOf(view.container).textContent).toContain("12/100");
    await view.unmount();
  });

  it("shows zero for an empty speech", async () => {
    const view = await mount(<SpeechWordCounter {...props()} />);
    expect(triggerOf(view.container).textContent).toContain("0/100");
    await view.unmount();
  });

  it("labels itself for screen readers with the speech name and count", async () => {
    const view = await mount(
      <SpeechWordCounter {...props({ text: words(5) })} />,
    );
    expect(triggerOf(view.container).getAttribute("aria-label")).toBe(
      "1AC word count: 5 of 100 words",
    );
    await view.unmount();
  });

  it("stays neutral well under the limit", async () => {
    const view = await mount(
      <SpeechWordCounter {...props({ text: words(50) })} />,
    );
    const className = triggerOf(view.container).className;
    expect(className).not.toContain("text-yellow-600");
    expect(className).not.toContain("text-[var(--text-error)]");
    await view.unmount();
  });

  it("warns from 90% of the limit", async () => {
    const view = await mount(
      <SpeechWordCounter {...props({ text: words(90) })} />,
    );
    expect(triggerOf(view.container).className).toContain("text-yellow-600");
    await view.unmount();
  });

  it("switches from warning to error once over the limit", async () => {
    const view = await mount(
      <SpeechWordCounter {...props({ text: words(101) })} />,
    );
    const className = triggerOf(view.container).className;
    expect(className).toContain("text-[var(--text-error)]");
    expect(className).not.toContain("text-yellow-600");
    await view.unmount();
  });

  it("tightens its layout in compact mode", async () => {
    const normal = await mount(<SpeechWordCounter {...props()} />);
    const compact = await mount(
      <SpeechWordCounter {...props({ compact: true })} />,
    );
    expect(triggerOf(normal.container).className).toContain("text-lg");
    expect(triggerOf(compact.container).className).toContain("text-sm");
    await normal.unmount();
    await compact.unmount();
  });

  it("passes an extra className through", async () => {
    const view = await mount(
      <SpeechWordCounter {...props({ className: "ml-4" })} />,
    );
    expect(triggerOf(view.container).className).toContain("ml-4");
    await view.unmount();
  });
});

describe("SpeechWordCounter popover", () => {
  it("keeps the editor closed until the readout is clicked", async () => {
    const view = await mount(<SpeechWordCounter {...props()} />);
    expect(contentOf()).toBeNull();
    await view.unmount();
  });

  it("opens an editor with the speech text in it", async () => {
    const view = await mount(
      <SpeechWordCounter {...props({ text: "hello there" })} />,
    );
    await click(triggerOf(view.container));

    const textarea = contentOf()?.querySelector("textarea");
    expect(textarea).not.toBeNull();
    expect((textarea as HTMLTextAreaElement).value).toBe("hello there");
    await view.unmount();
  });

  it("reports edits back to the caller", async () => {
    const onTextChange = vi.fn();
    const view = await mount(<SpeechWordCounter {...props({ onTextChange })} />);
    await click(triggerOf(view.container));

    await type(
      contentOf()?.querySelector("textarea") as HTMLTextAreaElement,
      "a new speech",
    );

    expect(onTextChange).toHaveBeenCalledWith("a new speech");
    await view.unmount();
  });

  it("shows how many words are left, then how many over", async () => {
    const under = await mount(
      <SpeechWordCounter {...props({ text: words(40) })} />,
    );
    await click(triggerOf(under.container));
    expect(contentOf()?.textContent).toContain("60 left");
    await under.unmount();

    const over = await mount(
      <SpeechWordCounter {...props({ text: words(105) })} />,
    );
    await click(triggerOf(over.container));
    expect(contentOf()?.textContent).toContain("5 over");
    await over.unmount();
  });

  it("names the speech in the editor header", async () => {
    const view = await mount(
      <SpeechWordCounter {...props({ speechName: "1AR" })} />,
    );
    await click(triggerOf(view.container));
    expect(contentOf()?.textContent).toContain("1AR");
    await view.unmount();
  });

  it("hides the dictation button when the browser cannot transcribe", async () => {
    const view = await mount(<SpeechWordCounter {...props()} />);
    await click(triggerOf(view.container));

    const buttons = [...(contentOf()?.querySelectorAll("button") ?? [])];
    expect(buttons.some((b) => b.textContent?.includes("Record"))).toBe(false);
    await view.unmount();
  });

  it("offers a dictation button when the browser supports it", async () => {
    class FakeRecognition {
      continuous = false;
      interimResults = false;
      lang = "";
      onresult: unknown = null;
      onerror: unknown = null;
      onend: unknown = null;
      start() {}
      stop() {}
    }
    (window as unknown as Record<string, unknown>).SpeechRecognition = FakeRecognition;

    const view = await mount(<SpeechWordCounter {...props()} />);
    await click(triggerOf(view.container));

    const buttons = [...(contentOf()?.querySelectorAll("button") ?? [])];
    expect(buttons.some((b) => b.textContent?.includes("Record"))).toBe(true);
    await view.unmount();
  });
});
