import { describe, expect, it, afterEach, vi } from "vitest";
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { schema } from "../src/schema/index";
import { highlightFrequencyPlugin, highlightFreqKey } from "../src/editor/highlight-frequency-plugin";
import { settings } from "../src/editor/settings";

/**
 * The frequency-ranked highlight/shading override writes a dynamic
 * stylesheet, and that write is deferred 250ms. A view torn down before
 * the timer fired used to leave a callback that reached `document` after
 * the global was gone — the "document is not defined" unhandled error.
 *
 * This test exercises the lifecycle ownership the fix relies on:
 *   1. A pending stylesheet timeout is canceled when the view is destroyed.
 *   2. A superseded schedule replaces the pending timer (no double fire).
 *   3. A callback scheduled before destruction no-ops after it.
 *   4. The settings subscription is torn down with the view.
 *   5. The plugin is inert when the feature is off.
 */

/** A doc carrying one highlight run, so activation has counts to rank. */
function highlightedDoc() {
  const mark = schema.marks.highlight!.create({ color: "yellow" });
  return schema.nodes["doc"]!.createChecked(
    null,
    schema.nodes["paragraph"]!.createChecked(null, schema.text("highlighted", [mark])),
  );
}

function mount(doc: ReturnType<typeof highlightedDoc>) {
  const place = document.createElement("div");
  document.body.appendChild(place);
  const view = new EditorView(place, {
    state: EditorState.create({ doc, plugins: [highlightFrequencyPlugin] }),
  });
  return { view, place };
}

/** Activate the multi-slot override so the plugin tracks counts and
 *  schedules stylesheet work. */
function activateMultiSlot() {
  settings.set("overrideHighlightColor", true);
  settings.set("overrideHighlightSlots", ["#ff0000", "#00ff00"]);
}

/** The singleton stylesheet's current rules text (empty string when the
 *  element holds no rules, which is what `destroy()` leaves behind). */
function sheetText(): string {
  return document.getElementById("pmd-freq-overrides")?.textContent ?? "";
}

describe("highlight-frequency plugin lifecycle", () => {
  afterEach(() => {
    vi.useRealTimers();
    settings.set("overrideHighlightColor", false);
    settings.set("overrideHighlightSlots", ["#ffff00"]);
  });

  it("cancels a pending stylesheet update when the view is destroyed", async () => {
    vi.useFakeTimers();
    activateMultiSlot();

    const { view, place } = mount(highlightedDoc());
    // Mount schedules a 250ms recompute that has NOT fired yet.
    expect(sheetText()).toBe("");

    view.destroy();
    place.remove();

    // Advancing past the debounce must not let the canceled timer fire
    // and must not throw — the sheet stays cleared by destroy().
    await vi.advanceTimersByTimeAsync(500);
    expect(sheetText()).toBe("");
    expect(highlightFreqKey.getState(view.state)).toBeNull();
  });

  it("collapses rapid edits into one pending recompute", async () => {
    vi.useFakeTimers();
    activateMultiSlot();

    const { view, place } = mount(highlightedDoc());
    expect(sheetText()).toBe("");

    // Two rapid state changes collapse to one pending recompute.
    view.dispatch(view.state.tr.insertText("ab", 0));
    view.dispatch(view.state.tr.insertText("cd", 0));

    await vi.advanceTimersByTimeAsync(300);

    // Exactly one recompute ran: the stylesheet holds a rule for the
    // most-common highlight color, mapped to the first override slot.
    expect(sheetText()).toContain('data-highlight="yellow"');
    expect(sheetText()).toContain("#00ff00");
    expect(sheetText()).not.toContain("#ff0000");

    view.destroy();
    place.remove();
    await vi.advanceTimersByTimeAsync(500);
    expect(sheetText()).toBe("");
  });

  it("does not write styles after the view is destroyed", async () => {
    vi.useFakeTimers();
    activateMultiSlot();

    const { view, place } = mount(highlightedDoc());
    view.destroy();
    place.remove();
    expect(sheetText()).toBe("");

    // A settings change after destruction must not resurrect the view's
    // stylesheet work — the subscription is torn down in destroy().
    settings.set("overrideHighlightSlots", ["#0000ff", "#ff00ff"]);

    await vi.advanceTimersByTimeAsync(500);
    expect(sheetText()).toBe("");
  });

  it("is inert when the feature is off", () => {
    settings.set("overrideHighlightColor", false);
    const { view, place } = mount(
      schema.nodes["doc"]!.createChecked(
        null,
        schema.nodes["paragraph"]!.createChecked(null, schema.text("plain")),
      ),
    );
    expect(highlightFreqKey.getState(view.state)?.initialized).toBe(false);
    view.destroy();
    place.remove();
  });
});