// @vitest-environment jsdom
/**
 * @fileoverview `CommentComposer` mounted for real: when it is allowed to send,
 * which keys send, and what Cancel throws away.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { CommentComposer } from "../src/CommentComposer";
import { MAX_COMMENT_BODY_LENGTH } from "../src/types";
import { button, click, cleanup, find, findAll, flush, focus, mount, type } from "./helpers/mount";

async function keyDown(
  target: HTMLElement,
  key: string,
  modifiers: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean } = {},
): Promise<KeyboardEvent> {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...modifiers });
  await flush(() => {
    target.dispatchEvent(event);
  });
  return event;
}

function composer(props: Partial<Parameters<typeof CommentComposer>[0]> = {}) {
  return (
    <CommentComposer
      placeholder="Add a comment"
      submitLabel="Comment"
      onSubmit={vi.fn().mockResolvedValue(undefined)}
      {...props}
    />
  );
}

describe("CommentComposer", () => {
  afterEach(cleanup);

  it("stays a single quiet line, with no buttons, until it is touched", async () => {
    const { container } = await mount(composer());
    expect(container.querySelector("button")).toBeNull();
    expect(find<HTMLTextAreaElement>(container, "textarea").rows).toBe(1);

    await focus(find(container, "textarea"));
    expect(findAll(container, "button").map((b) => b.textContent)).toEqual(["Cancel", "Comment"]);
  });

  it("shows its buttons from the start in the compact (reply) form", async () => {
    const { container } = await mount(composer({ compact: true, submitLabel: "Reply" }));
    expect(findAll(container, "button").map((b) => b.textContent)).toEqual(["Cancel", "Reply"]);
    expect(find<HTMLTextAreaElement>(container, "textarea").rows).toBe(1);
  });

  it("will not send blank text, and trims what it does send", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { container } = await mount(composer({ compact: true, onSubmit }));
    const textarea = find<HTMLTextAreaElement>(container, "textarea");

    expect(button(container, "Comment").disabled).toBe(true);
    await type(textarea, "   ");
    expect(button(container, "Comment").disabled).toBe(true);
    await click(button(container, "Comment"));
    expect(onSubmit).not.toHaveBeenCalled();

    await type(textarea, "  hello there \n");
    await click(button(container, "Comment"));
    expect(onSubmit).toHaveBeenCalledWith("hello there");
    expect(textarea.value).toBe("");
  });

  it("sends on a plain Enter but not on Shift+Enter in the full composer", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { container } = await mount(composer({ onSubmit }));
    const textarea = find<HTMLTextAreaElement>(container, "textarea");
    await type(textarea, "first line");

    const shifted = await keyDown(textarea, "Enter", { shiftKey: true });
    expect(shifted.defaultPrevented).toBe(false);
    expect(onSubmit).not.toHaveBeenCalled();

    const plain = await keyDown(textarea, "Enter");
    expect(plain.defaultPrevented).toBe(true);
    expect(onSubmit).toHaveBeenCalledWith("first line");
  });

  it("leaves a plain Enter as a newline in the compact composer, and sends on Ctrl or Cmd+Enter", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { container } = await mount(composer({ compact: true, onSubmit }));
    const textarea = find<HTMLTextAreaElement>(container, "textarea");
    await type(textarea, "a reply");

    const plain = await keyDown(textarea, "Enter");
    expect(plain.defaultPrevented).toBe(false);
    expect(onSubmit).not.toHaveBeenCalled();

    await keyDown(textarea, "Enter", { ctrlKey: true });
    expect(onSubmit).toHaveBeenCalledTimes(1);

    await type(textarea, "another");
    await keyDown(textarea, "Enter", { metaKey: true });
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expect(onSubmit).toHaveBeenLastCalledWith("another");
  });

  it("ignores other keys", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { container } = await mount(composer({ onSubmit }));
    const textarea = find<HTMLTextAreaElement>(container, "textarea");
    await type(textarea, "text");

    const event = await keyDown(textarea, "a", { ctrlKey: true });
    expect(event.defaultPrevented).toBe(false);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("clears the text and calls onCancel when Cancel is clicked", async () => {
    const onCancel = vi.fn();
    const { container } = await mount(composer({ compact: true, onCancel }));
    const textarea = find<HTMLTextAreaElement>(container, "textarea");
    await type(textarea, "draft");

    await click(button(container, "Cancel"));

    expect(textarea.value).toBe("");
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("will not send while submitting or disabled, and labels the busy state", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const busy = await mount(composer({ compact: true, submitting: true, onSubmit }));
    await type(find<HTMLTextAreaElement>(busy.container, "textarea"), "text");
    expect(button(busy.container, "Posting…").disabled).toBe(true);
    expect(button(busy.container, "Cancel").disabled).toBe(true);
    await keyDown(find(busy.container, "textarea"), "Enter", { ctrlKey: true });

    const off = await mount(composer({ compact: true, disabled: true, onSubmit }));
    expect(find<HTMLTextAreaElement>(off.container, "textarea").disabled).toBe(true);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("counts down the characters left only when the limit is near", async () => {
    const { container } = await mount(composer({ compact: true }));
    const textarea = find<HTMLTextAreaElement>(container, "textarea");
    expect(container.querySelector(".tabular-nums")).toBeNull();

    await type(textarea, "x".repeat(MAX_COMMENT_BODY_LENGTH - 499));
    expect(find(container, ".tabular-nums").textContent).toBe("499");
  });

  it("uses its placeholder as the accessible name", async () => {
    const { container } = await mount(composer({ placeholder: "Reply to Ana" }));
    expect(find(container, "textarea").getAttribute("aria-label")).toBe("Reply to Ana");
  });
});
