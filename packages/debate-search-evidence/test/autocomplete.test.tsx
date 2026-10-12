// @vitest-environment jsdom
/**
 * @fileoverview The search box's `Autocomplete`: the inline completion, arrow
 * keys loading the next suggestion, Enter committing, and an older suggestion
 * request never replacing the answer for newer text.
 */

import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Autocomplete } from "../src/ui/primitives/autocomplete";
import { flush, mount, type Mounted } from "./helpers/mount";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let mounted: Mounted | null = null;

beforeEach(() => vi.useFakeTimers());
afterEach(async () => {
  await mounted?.unmount();
  mounted = null;
  vi.useRealTimers();
});

async function renderBox(fetchOptions: (q: string) => Promise<string[]>) {
  const onChange = vi.fn();
  const onCommit = vi.fn();
  function Box() {
    const [value, setValue] = useState("");
    return (
      <Autocomplete
        value={value}
        onChange={(v) => {
          onChange(v);
          setValue(v);
        }}
        onCommit={(v) => {
          onCommit(v);
          setValue(v);
        }}
        fetchOptions={fetchOptions}
        inlineCompletion
      />
    );
  }
  mounted = await mount(<Box />);
  const input = mounted.container.querySelector("input")!;
  return { input, onChange, onCommit, container: mounted.container };
}

async function type(input: HTMLInputElement, text: string) {
  await flush(() => {
    input.focus();
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setter.call(input, text);
    input.setSelectionRange(text.length, text.length);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await flush(() => vi.advanceTimersByTimeAsync(200));
}

async function press(input: HTMLInputElement, key: string) {
  await flush(() => {
    input.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  });
}

describe("Autocomplete", () => {
  it("shows the top completion inline and accepts it with Tab", async () => {
    const { input, onCommit, container } = await renderBox(async () => ["nuclear deterrence", "nuclear deal"]);
    await type(input, "nuclear dete");
    expect(container.textContent).toContain("rrence");

    await press(input, "Tab");
    expect(onCommit).toHaveBeenCalledWith("nuclear deterrence");
    expect(input.value).toBe("nuclear deterrence");
  });

  it("loads each suggestion into the box as the arrow keys reach it", async () => {
    const { input, onChange } = await renderBox(async () => ["nuclear deterrence", "nuclear deal"]);
    await type(input, "nuclear de");

    await press(input, "ArrowDown");
    expect(input.value).toBe("nuclear deterrence");
    await press(input, "ArrowDown");
    expect(input.value).toBe("nuclear deal");
    expect(onChange).toHaveBeenLastCalledWith("nuclear deal");
    // Past the last suggestion, back to what was typed.
    await press(input, "ArrowDown");
    expect(input.value).toBe("nuclear de");
  });

  it("commits the typed text on Enter", async () => {
    const { input, onCommit } = await renderBox(async () => []);
    await type(input, "warming");
    await press(input, "Enter");
    expect(onCommit).toHaveBeenCalledWith("warming");
  });

  it("ignores a slow suggestion answer for older text", async () => {
    const answers: Record<string, (v: string[]) => void> = {};
    const { input, container } = await renderBox(
      (q) => new Promise<string[]>((resolve) => (answers[q] = resolve)),
    );
    await type(input, "nu");
    await type(input, "nuclear");
    await flush(async () => answers["nuclear"](["nuclear war"]));
    await flush(async () => answers["nu"](["numbers"]));
    expect(container.textContent).toContain("nuclear war");
    expect(container.textContent).not.toContain("numbers");
  });
});
