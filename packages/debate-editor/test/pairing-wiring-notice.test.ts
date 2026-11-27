import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetNoticesForTests, noticeCount, wireStatusNotices } from "../src/editor/status-notices.js";
import { postRelayRejectedNotice } from "../src/editor/pairing/pairing-wiring.js";

describe("pairing wiring — relay rejected credentials", () => {
  beforeEach(() => {
    document.body.innerHTML = '<button id="notice-chip" hidden></button>';
    wireStatusNotices();
    __resetNoticesForTests();
  });

  afterEach(() => {
    __resetNoticesForTests();
    document.body.innerHTML = "";
  });

  it("files a status-bar notice without floating a toast over the page", () => {
    postRelayRejectedNotice();

    expect(noticeCount()).toBe(1);
    expect(document.getElementById("notice-chip")?.hidden).toBe(false);
    expect(document.body.textContent).not.toContain("relay rejected your credentials");
    expect(document.querySelector(".pmd-toast")).toBeNull();
  });

  it("coalesces repeated failures into one notice", () => {
    postRelayRejectedNotice();
    postRelayRejectedNotice();
    expect(noticeCount()).toBe(1);
  });
});
