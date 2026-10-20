import { describe, expect, it } from "vitest";
import { EMAIL_TEMPLATES, isEmailTemplateId, renderEmail, renderEmailPreview } from "../src";

describe("email templates", () => {
  it.each(EMAIL_TEMPLATES.map((template) => template.id))("renders %s with its sample data", async (id) => {
    const email = await renderEmailPreview(id, "https://staging.example.com");
    expect(email.subject.length).toBeGreaterThan(0);
    expect(email.html).toMatch(/^<!DOCTYPE html/i);
    expect(email.html).toContain('src="https://staging.example.com/logo.png"');
    expect(email.html).not.toContain("d.ebate.app");
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
    expect(email.html).toContain("/research/team?section=inbox");
  });

  it("recognizes template ids", () => {
    expect(isEmailTemplateId("welcome")).toBe(true);
    expect(isEmailTemplateId("toString")).toBe(false);
  });
});
