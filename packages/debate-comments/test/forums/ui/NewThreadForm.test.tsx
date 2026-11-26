// @vitest-environment jsdom
/**
 * @fileoverview `NewThreadForm` mounted for real: when the post button is
 * enabled, what is submitted, and what survives a rejected post.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { NewThreadForm } from "../../../src/forums/ui/NewThreadForm";
import { MAX_THREAD_TITLE_LENGTH } from "../../../src/forums/types";
import { cleanup, find, flush, mount, setValue } from "../../helpers/mount";

function fields(container: HTMLElement) {
  return {
    title: find<HTMLInputElement>(container, "#forum-thread-title"),
    body: find<HTMLTextAreaElement>(container, "#forum-thread-body"),
    category: find<HTMLSelectElement>(container, "select"),
    submit: find<HTMLButtonElement>(container, "button[type=submit]"),
    form: find<HTMLFormElement>(container, "form"),
  };
}

async function submitForm(form: HTMLFormElement) {
  await flush(() => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

describe("NewThreadForm", () => {
  afterEach(cleanup);

  it("keeps the post button disabled until both title and body have text", async () => {
    const { container } = await mount(<NewThreadForm onSubmit={vi.fn()} />);
    const { title, body, submit } = fields(container);
    expect(submit.disabled).toBe(true);

    await setValue(title, "A title");
    expect(submit.disabled).toBe(true);

    await setValue(body, "   ");
    expect(submit.disabled).toBe(true);

    await setValue(body, "An opening post");
    expect(submit.disabled).toBe(false);
  });

  it("submits trimmed text with the chosen category, then clears the fields", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { container } = await mount(<NewThreadForm onSubmit={onSubmit} />);
    const { title, body, category, form } = fields(container);

    expect(category.value).toBe("general");
    await setValue(category, "policy");
    await setValue(title, "  Is the aff topical?  ");
    await setValue(body, "  Walk me through it.\n");
    await submitForm(form);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      title: "Is the aff topical?",
      body: "Walk me through it.",
      category: "policy",
    });
    expect(title.value).toBe("");
    expect(body.value).toBe("");
  });

  it("opens on the default category it is given and ignores unknown option values", async () => {
    const { container } = await mount(
      <NewThreadForm onSubmit={vi.fn()} defaultCategory="college" />,
    );
    const { category } = fields(container);
    expect(category.value).toBe("college");

    await setValue(category, "not-a-board");
    expect(category.value).toBe("college");
  });

  it("does not submit when a field is empty", async () => {
    const onSubmit = vi.fn();
    const { container } = await mount(<NewThreadForm onSubmit={onSubmit} />);
    const { title, form } = fields(container);

    await setValue(title, "Only a title");
    await submitForm(form);

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("keeps the writer's text and shows the error when the post is rejected", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("Slow down a little."));
    const { container } = await mount(<NewThreadForm onSubmit={onSubmit} />);
    const { title, body, form, submit } = fields(container);

    await setValue(title, "Title");
    await setValue(body, "Body");
    await submitForm(form);

    expect(find(container, "[role=alert]").textContent).toBe("Slow down a little.");
    expect(title.value).toBe("Title");
    expect(body.value).toBe("Body");
    expect(submit.disabled).toBe(false);
    expect(submit.textContent).toBe("Post thread");
  });

  it("falls back to a generic message for a non-Error rejection", async () => {
    const onSubmit = vi.fn().mockRejectedValue("nope");
    const { container } = await mount(<NewThreadForm onSubmit={onSubmit} />);
    const { title, body, form } = fields(container);

    await setValue(title, "Title");
    await setValue(body, "Body");
    await submitForm(form);

    expect(find(container, "[role=alert]").textContent).toBe("Could not post your thread.");
  });

  it("disables the fields and shows progress while the post is in flight", async () => {
    let finish!: () => void;
    const onSubmit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const { container } = await mount(<NewThreadForm onSubmit={onSubmit} />);
    const { title, body, form, submit } = fields(container);

    await setValue(title, "Title");
    await setValue(body, "Body");
    await submitForm(form);

    expect(submit.textContent).toBe("Posting…");
    expect(submit.disabled).toBe(true);
    expect(title.disabled).toBe(true);
    expect(body.disabled).toBe(true);

    await flush(() => finish());
    expect(submit.textContent).toBe("Post thread");
    expect(title.disabled).toBe(false);
  });

  it("shows the remaining title characters only near the limit", async () => {
    const { container } = await mount(<NewThreadForm onSubmit={vi.fn()} />);
    const { title } = fields(container);

    await setValue(title, "x".repeat(MAX_THREAD_TITLE_LENGTH - 20));
    expect(container.querySelector("span.tabular-nums")).toBeNull();

    await setValue(title, "x".repeat(MAX_THREAD_TITLE_LENGTH - 19));
    expect(find(container, "span.tabular-nums").textContent).toBe("19");
  });
});
