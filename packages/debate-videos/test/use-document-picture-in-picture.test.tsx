// @vitest-environment jsdom
/**
 * @fileoverview Covers the hook that pops the video player into an
 * always-on-top Document Picture-in-Picture window.
 *
 * What a user notices when it breaks: the player has to land back where it
 * was when the window closes, and a refused request (no click activation, an
 * unsupported browser) must leave the player on the page rather than losing
 * it behind an orphaned placeholder.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { act, createElement, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";

import { useDocumentPictureInPicture } from "../src/components/video-player/useDocumentPictureInPicture";

type Api = ReturnType<typeof useDocumentPictureInPicture>;

let root: Root | null = null;
let host: HTMLDivElement | null = null;

async function renderHook() {
  let api!: Api;
  function Harness() {
    const ref = useRef<HTMLDivElement | null>(null);
    api = useDocumentPictureInPicture(ref);
    return createElement("section", null, createElement("div", { ref, id: "player" }));
  }
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root!.render(createElement(Harness)));
  return () => api;
}

afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
  root = null;
  host = null;
  delete window.documentPictureInPicture;
});

describe("useDocumentPictureInPicture", () => {
  it("reports unsupported when the API is missing", async () => {
    const api = await renderHook();
    expect(api().isSupported).toBe(false);
  });

  it("moves the player into the window and back when it closes", async () => {
    const pipDoc = document.implementation.createHTMLDocument("pip");
    const listeners: Record<string, () => void> = {};
    const pipWindow = {
      document: pipDoc,
      close: vi.fn(),
      addEventListener: (type: string, fn: () => void) => (listeners[type] = fn),
    } as unknown as Window;
    const docPip = {
      window: null as Window | null,
      requestWindow: vi.fn(async () => {
        docPip.window = pipWindow;
        return pipWindow;
      }),
    };
    window.documentPictureInPicture = docPip;

    const api = await renderHook();
    expect(api().isSupported).toBe(true);

    await act(async () => api().toggle());
    expect(pipDoc.body.querySelector("#player")).not.toBeNull();
    expect(api().isActive).toBe(true);

    await act(async () => listeners.pagehide());
    expect(host!.querySelector("section > #player")).not.toBeNull();
    expect(host!.innerHTML).not.toContain("video-pip-anchor");
    expect(api().isActive).toBe(false);
  });

  it("leaves the player in place when the window request is refused", async () => {
    window.documentPictureInPicture = {
      window: null,
      requestWindow: vi.fn(async () => {
        throw new DOMException("needs user activation", "NotAllowedError");
      }),
    };

    const api = await renderHook();
    await act(async () => api().toggle());

    expect(host!.querySelector("section > #player")).not.toBeNull();
    expect(host!.innerHTML).not.toContain("video-pip-anchor");
    expect(api().isActive).toBe(false);
  });
});
