import { describe, expect, it } from "vitest";
import { cn } from "../src/ui/lib/utils";

describe("cn", () => {
  it("joins class names", () => {
    expect(cn("px-2", "py-1")).toBe("px-2 py-1");
  });

  it("drops falsy values", () => {
    expect(cn("px-2", false, null, undefined, "")).toBe("px-2");
  });

  it("supports conditional object and array syntax", () => {
    expect(cn("base", { active: true, hidden: false }, ["extra"])).toBe(
      "base active extra",
    );
  });

  it("lets later tailwind utilities win over earlier conflicting ones", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("keeps non-conflicting utilities from both sides", () => {
    expect(cn("p-2 text-sm", "text-lg")).toBe("p-2 text-lg");
  });

  it("returns an empty string with no input", () => {
    expect(cn()).toBe("");
  });
});
