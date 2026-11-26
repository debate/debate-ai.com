import { describe, expect, it } from "vitest";
import {
  EMAIL_TEMPLATES,
  WELCOME_TEMPLATE_STARTER,
  isEmailTemplateId,
  isSafeEmailHref,
  parseEmailBody,
  renderCustomEmail,
  renderEmail,
  renderEmailPreview,
} from "../src";

describe("email templates", () => {
  it.each(EMAIL_TEMPLATES.map((template) => template.id))("renders %s with its sample data", async (id) => {
    const email = await renderEmailPreview(id, "https://staging.example.com");
    expect(email.subject.length).toBeGreaterThan(0);
    expect(email.html).toMatch(/^<!DOCTYPE html/i);
    expect(email.html).toContain('src="https://staging.example.com/logo.png"');
    expect(email.html).not.toContain("d.ebate.app");
    expect(email.html).toContain("Unsubscribe");
    expect(email.html).toContain("https://debate-ai.invalid/unsubscribe");
    expect(email.text.length).toBeGreaterThan(50);
    expect(email.text).not.toContain("<");
  });

  it("falls back to the canonical host", async () => {
    const email = await renderEmailPreview("welcome");
    expect(email.html).toContain("https://d.ebate.app/logo.png");
  });

  it("fills a round invite from its props and escapes them", async () => {
    const email = await renderEmail("round-invite", {
      inviterName: "Pat <script>",
      tournamentName: "TOC",
      roundLevel: "Finals",
      link: "/debate/toc-finals",
      baseUrl: "https://d.ebate.app",
    });
    expect(email.subject).toBe("Pat <script> invited you to a debate round");
    expect(email.html).toContain("TOC — Finals");
    expect(email.html).toContain('href="https://d.ebate.app/debate/toc-finals"');
    expect(email.html).not.toContain("<script>");
  });

  it("links a file invite to the shared cards tab and quotes the note", async () => {
    const email = await renderEmail("file-invite", {
      inviterName: "Sam",
      fileTitle: "1AC",
      message: "Take a look",
    });
    expect(email.subject).toBe('Sam invited you to collaborate on "1AC"');
    expect(email.html).toContain("https://d.ebate.app/contacts?tab=shared");
    expect(email.text).toContain("Take a look");
  });

  it("lists the research-team tools in the coach email", async () => {
    const email = await renderEmail("coach-features", {});
    expect(email.text).toContain("Manage your research team");
    expect(email.html).toContain("/research?section=routing");
  });

  it("recognizes template ids", () => {
    expect(isEmailTemplateId("welcome")).toBe(true);
    expect(isEmailTemplateId("toString")).toBe(false);
  });
});

describe("custom (admin-written) emails", () => {
  it("renders headings, paragraphs, links and buttons inside the layout with the unsubscribe footer", async () => {
    const email = await renderCustomEmail({
      subject: "  Hi there ",
      body: "# Big news\n\nRead [the docs](/docs)\nor [email us](mailto:a@b.co).\n\n[Open it](https://example.com/x)",
      baseUrl: "https://staging.example.com",
    });
    expect(email.subject).toBe("Hi there");
    expect(email.html).toContain("Big news");
    expect(email.html).toContain('href="https://staging.example.com/docs"');
    expect(email.html).toContain('href="https://example.com/x"');
    expect(email.html).toContain("https://debate-ai.invalid/unsubscribe");
    expect(email.text).toContain("Big news");
  });

  it("escapes HTML and drops unsafe link targets", async () => {
    const email = await renderCustomEmail({ subject: "x", body: "<script>alert(1)</script> [bad](javascript:alert(1))" });
    expect(email.html).not.toContain("<script>");
    expect(email.html).not.toContain('href="javascript:');
  });

  it("renders the Welcome starter", async () => {
    const email = await renderCustomEmail({ ...WELCOME_TEMPLATE_STARTER });
    expect(email.html).toContain("Research evidence");
    expect(email.html).toContain("https://d.ebate.app/research");
  });
});

describe("parseEmailBody", () => {
  it("splits blocks on blank lines and keeps line breaks within a paragraph", () => {
    const blocks = parseEmailBody("# Title\n\nline one\nline two\n\n\n[Go](/x)");
    expect(blocks.map((block) => block.type)).toEqual(["heading", "paragraph", "button"]);
    expect(blocks[1]).toMatchObject({ type: "paragraph", lines: [[{ text: "line one" }], [{ text: "line two" }]] });
  });

  it("only links http(s), mailto and site paths", () => {
    expect(isSafeEmailHref("https://a.co")).toBe(true);
    expect(isSafeEmailHref("/docs")).toBe(true);
    expect(isSafeEmailHref("//evil.com")).toBe(false);
    expect(isSafeEmailHref("javascript:alert(1)")).toBe(false);
  });
});
