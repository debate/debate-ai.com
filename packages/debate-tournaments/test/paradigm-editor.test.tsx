// @vitest-environment jsdom
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  JUDGE_PARADIGMS_API,
  createJudgeProfileLookup,
  fetchOwnParadigm,
  judgeProfileUrl,
  saveOwnParadigm,
  verifyOwnParadigm,
} from "../src/judge-paradigms/client";
import type { OwnParadigm } from "../src/judge-paradigms/types";
import { JudgeParadigmEditor, applyMark } from "../src/ui/paradigm/JudgeParadigmEditor";
import { byText, click, render, settle, text, type as typeInto, unmountAll } from "./helpers/dom";

const own = (over: Partial<OwnParadigm> = {}): OwnParadigm => ({
  tabroomPersonId: null,
  verified: false,
  verifyCode: "VERIFY-123",
  markdown: "",
  html: "",
  updatedAt: null,
  ...over,
});

interface Server {
  me: Response | OwnParadigm;
  put?: (body: Record<string, unknown>) => Response | OwnParadigm;
  verify?: () => Response | OwnParadigm;
}

function stubServer(server: Server) {
  const calls: Array<{ url: string; method: string; body?: Record<string, unknown> }> = [];
  const asResponse = (v: Response | OwnParadigm) => (v instanceof Response ? v : Response.json(v));
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url, method, body });
      if (url.endsWith("/me/verify")) return asResponse(server.verify!());
      if (method === "PUT") return asResponse(server.put!(body));
      return asResponse(server.me);
    }),
  );
  return calls;
}

afterEach(() => {
  unmountAll();
  vi.unstubAllGlobals();
});

const area = (el: HTMLElement) => el.querySelector('textarea[aria-label="Paradigm"]') as HTMLTextAreaElement;
const saveButton = (el: HTMLElement) => byText(el, "button", /Save paradigm/) as HTMLButtonElement;
const status = (el: HTMLElement) => el.querySelector('span[role="status"]')?.textContent ?? "";

describe("applyMark", () => {
  const bold = { label: "Bold", icon: null as never, wrap: ["**", "**"] as [string, string] };
  const list = { label: "List", icon: null as never, linePrefix: "- " };
  const numbered = { label: "Numbered", icon: null as never, linePrefix: (i: number) => `${i + 1}. ` };

  it("wraps the selection, selecting what was wrapped", () => {
    expect(applyMark("say hello now", 4, 9, bold)).toEqual({ text: "say **hello** now", start: 6, end: 11 });
  });

  it("wraps a placeholder word when nothing is selected", () => {
    expect(applyMark("", 0, 0, bold)).toEqual({ text: "**bold**", start: 2, end: 6 });
  });

  it("prefixes every selected line, starting from the beginning of the first", () => {
    expect(applyMark("one\ntwo\nthree", 5, 9, list)).toEqual({ text: "one\n- two\n- three", start: 4, end: 13 });
    expect(applyMark("one\ntwo\nthree", 5, 9, numbered).text).toBe("one\n1. two\n2. three");
  });
});

describe("judge paradigm API client", () => {
  const json = (body: unknown, status = 200) => Response.json(body, { status });

  it("builds a profile URL from a person id, or from a full name, or not at all", () => {
    expect(judgeProfileUrl({ personId: 9, first: "", last: "" })).toBe(`${JUDGE_PARADIGMS_API}?personId=9`);
    expect(judgeProfileUrl({ first: " Sam ", last: " Lee " })).toBe(`${JUDGE_PARADIGMS_API}?first=Sam&last=Lee`);
    expect(judgeProfileUrl({ first: "Sam", last: " " })).toBeNull();
  });

  it("looks a judge up once, and again after a miss", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ profile: null }))
      .mockResolvedValueOnce(json({ profile: { name: "Sam Lee" } }))
      .mockResolvedValue(json({ profile: { name: "Sam Lee" } }));
    const lookup = createJudgeProfileLookup("/x", fetchImpl);
    const query = { personId: 5, first: "Sam", last: "Lee" };

    expect(await lookup(query)).toBeNull();
    expect(await lookup(query)).toMatchObject({ name: "Sam Lee" });
    expect(await lookup(query)).toMatchObject({ name: "Sam Lee" });
    // The miss was forgotten; the hit is cached.
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0][0]).toBe("/x?personId=5");
    expect(await lookup({ first: "", last: "" })).toBeNull();
  });

  it("treats an HTTP error or a network failure as no profile", async () => {
    expect(await createJudgeProfileLookup("/x", async () => json({}, 500))({ personId: 1, first: "", last: "" })).toBeNull();
    expect(
      await createJudgeProfileLookup("/x", async () => {
        throw new TypeError("offline");
      })({ personId: 1, first: "", last: "" }),
    ).toBeNull();
  });

  it("reads the viewer's own paradigm, with null when signed out", async () => {
    expect(await fetchOwnParadigm(async () => json(own({ markdown: "hi" })))).toMatchObject({ markdown: "hi" });
    expect(await fetchOwnParadigm(async () => json({}, 401))).toBeNull();
  });

  it("raises the server's message, or a fallback when it sent none", async () => {
    await expect(fetchOwnParadigm(async () => json({ error: "Database is down" }, 500))).rejects.toThrow("Database is down");
    await expect(fetchOwnParadigm(async () => new Response("<html>", { status: 502 }))).rejects.toThrow("Could not load your paradigm.");
    await expect(saveOwnParadigm({ tabroomPersonId: null, markdown: "" }, async () => json({ error: "" }, 400))).rejects.toThrow("Could not save your paradigm.");
    await expect(verifyOwnParadigm(async () => json({ error: 7 }, 400))).rejects.toThrow("Could not verify your Tabroom account.");
  });

  it("saves with PUT and verifies with POST", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => json(own({ verified: true })));
    expect(await saveOwnParadigm({ tabroomPersonId: 12, markdown: "## Hi" }, fetchImpl)).toMatchObject({ verified: true });
    expect(fetchImpl).toHaveBeenLastCalledWith(`${JUDGE_PARADIGMS_API}/me`, expect.objectContaining({ method: "PUT", body: JSON.stringify({ tabroomPersonId: 12, markdown: "## Hi" }) }));
    await verifyOwnParadigm(fetchImpl);
    expect(fetchImpl).toHaveBeenLastCalledWith(`${JUDGE_PARADIGMS_API}/me/verify`, { method: "POST" });
  });
});

describe("JudgeParadigmEditor", () => {
  it("shows a loading state first, then a sign-in prompt for a signed-out visitor", async () => {
    stubServer({ me: new Response("{}", { status: 401 }) });
    const el = await render(<JudgeParadigmEditor />, null);
    expect(text(el)).toContain("Sign in to write your paradigm");
    expect(el.querySelector("a")?.getAttribute("href")).toBe("/login?callbackURL=%2Fpractice%2Fparadigm");
  });

  it("shows the failure message when the paradigm cannot be loaded", async () => {
    stubServer({ me: Response.json({ error: "Database is down" }, { status: 500 }) });
    const el = await render(<JudgeParadigmEditor />, null);
    expect(text(el)).toContain("Database is down");
    expect(text(el)).not.toContain("Sign in to write your paradigm");
  });

  it("loads the stored markdown and Tabroom id, with Save off until something changes", async () => {
    stubServer({ me: own({ markdown: "Tech judge.", tabroomPersonId: 12345, verified: true, updatedAt: "2026-01-02T03:04:05Z" }) });
    const el = await render(<JudgeParadigmEditor />, null);
    expect(area(el).value).toBe("Tech judge.");
    expect((el.querySelector("#tabroom-judge") as HTMLInputElement).value).toBe("12345");
    expect(text(el)).toContain("Verified Tabroom judge #12345");
    expect(text(el)).toContain("Markdown · 11 / 30,000");
    expect(status(el)).toContain("Last saved");
    expect(byText(el, "button", "Verify")).toBeNull();
    expect(saveButton(el).disabled).toBe(true);
  });

  it("saves edits, sending the parsed Tabroom id, and reports it", async () => {
    const calls = stubServer({ me: own({ markdown: "old" }), put: (body) => own({ markdown: String(body.markdown), tabroomPersonId: body.tabroomPersonId as number }) });
    const el = await render(<JudgeParadigmEditor />, null);
    await typeInto(area(el), "new text");
    await typeInto(el.querySelector("#tabroom-judge"), "https://www.tabroom.com/index/paradigm.mhtml?judge_person_id=777");
    expect(saveButton(el).disabled).toBe(false);
    await click(saveButton(el));
    await settle();

    expect(calls.find((c) => c.method === "PUT")?.body).toEqual({ tabroomPersonId: 777, markdown: "new text" });
    expect(status(el)).toBe("Saved.");
    // The saved copy is now the baseline, and a new, unverified link asks for verification.
    expect(saveButton(el).disabled).toBe(true);
    expect(text(el)).toContain("Not verified yet");
    expect(text(el)).toContain("VERIFY-123");
  });

  it("rejects an unrecognizable Tabroom link without allowing a save", async () => {
    stubServer({ me: own({ markdown: "x" }) });
    const el = await render(<JudgeParadigmEditor />, null);
    await typeInto(el.querySelector("#tabroom-judge"), "not a link");
    expect(text(el)).toContain("That isn't a Tabroom judge id or paradigm link.");
    expect(el.querySelector("#tabroom-judge")?.getAttribute("aria-invalid")).toBe("true");
    expect(saveButton(el).disabled).toBe(true);
  });

  it("shows a save failure", async () => {
    stubServer({ me: own({ markdown: "x" }), put: () => Response.json({ error: "Too long" }, { status: 413 }) });
    const el = await render(<JudgeParadigmEditor />, null);
    await typeInto(area(el), "xy");
    await click(saveButton(el));
    expect(status(el)).toBe("Too long");
    expect(el.querySelector('span[role="status"]')?.className).toContain("text-destructive");
  });

  it("verifies a linked account, but only once unsaved changes are saved", async () => {
    const calls = stubServer({
      me: own({ tabroomPersonId: 55, markdown: "x" }),
      verify: () => own({ tabroomPersonId: 55, verified: true, markdown: "x" }),
    });
    const el = await render(<JudgeParadigmEditor />, null);
    const verify = () => byText(el, "button", "Verify") as HTMLButtonElement;
    await typeInto(area(el), "xy");
    expect(verify().disabled).toBe(true);
    expect(text(el)).toContain("Save your changes before verifying.");
    await typeInto(area(el), "x");
    expect(verify().disabled).toBe(false);

    await click(verify());
    await settle();
    expect(calls.some((c) => c.url.endsWith("/me/verify") && c.method === "POST")).toBe(true);
    expect(status(el)).toContain("Verified — your paradigm now shows in pairings.");
    expect(text(el)).toContain("Verified Tabroom judge #55");
  });

  it("shows a verification failure", async () => {
    stubServer({ me: own({ tabroomPersonId: 55 }), verify: () => Response.json({ error: "Code not found on your paradigm" }, { status: 422 }) });
    const el = await render(<JudgeParadigmEditor />, null);
    await click(byText(el, "button", "Verify"));
    expect(status(el)).toBe("Code not found on your paradigm");
  });

  it("copies the verification code to the clipboard", async () => {
    stubServer({ me: own({ tabroomPersonId: 55 }) });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const el = await render(<JudgeParadigmEditor />, null);
    await click(byText(el, "button", /Copy/));
    await settle();
    expect(writeText).toHaveBeenCalledWith("VERIFY-123");
    expect(text(byText(el, "button", /Copied/))).toContain("Copied");
  });

  it("applies toolbar formatting to the selected text", async () => {
    stubServer({ me: own({ markdown: "say hello" }) });
    vi.stubGlobal("requestAnimationFrame", (cb: () => void) => setTimeout(cb, 0));
    const el = await render(<JudgeParadigmEditor />, null);
    area(el).setSelectionRange(4, 9);
    await click(el.querySelector('[aria-label="Bold"]'));
    await settle();
    expect(area(el).value).toBe("say **hello**");
    expect(area(el).selectionStart).toBe(6);
    expect(saveButton(el).disabled).toBe(false);

    area(el).setSelectionRange(0, 0);
    await click(el.querySelector('[aria-label="Heading"]'));
    expect(area(el).value).toBe("## say **hello**");
  });

  it("previews the rendered, sanitized Markdown, or says there is nothing to preview", async () => {
    stubServer({ me: own({ markdown: "" }) });
    const el = await render(<JudgeParadigmEditor />, null);
    const openPreview = async () => {
      const trigger = byText(el, '[role="tab"]', "Preview")!;
      await act(async () => {
        trigger.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0, ctrlKey: false }));
        (trigger as HTMLElement).focus();
      });
    };
    await openPreview();
    expect(text(el)).toContain("Nothing to preview yet.");

    const write = byText(el, '[role="tab"]', "Write")!;
    await act(async () => {
      write.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
    });
    await typeInto(area(el), "## Overview\n\n**tech** <script>alert(1)</script>");
    await openPreview();
    const preview = el.querySelector("[data-paradigm-preview]")!;
    expect(preview.querySelector("h2")?.textContent).toBe("Overview");
    expect(preview.querySelector("strong")?.textContent).toBe("tech");
    expect(preview.querySelector("script")).toBeNull();
  });
});
