/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let authenticated = false;
vi.mock("../../../src/lib/hooks/useSession", () => ({
  useSession: () => ({ session: null, user: null, isAuthenticated: authenticated, isLoading: false }),
}));

import {
  FAVORITE_REFERENCES_STORAGE_KEY,
  readFavoriteReferences,
  toFavoriteReference,
  toggleFavoriteReference,
} from "@debate-ai/reading-mode/favorites";
import { findToolRecordCollection } from "@debate-ai/research-evidence/src/account-sync/toolRecordCollections";
import { FavoriteReferencesPanel } from "../../../src/components/research/FavoriteReferencesPanel";

let root: Root | null = null;
let container: HTMLElement | null = null;

afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  root = container = null;
  localStorage.clear();
  authenticated = false;
});

async function render() {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root!.render(<FavoriteReferencesPanel />));
}

const reference = (citation: string, url = "") => ({
  title: "",
  authors: "Ackerman",
  year: "2020",
  publication: "",
  citation,
  url,
});

describe("FavoriteReferencesPanel", () => {
  it("is where the account sync keeps the docs favorites: the catalog entry uses the store's key", () => {
    const entry = findToolRecordCollection("docsFavoriteReferences");
    expect(entry?.storageKey).toBe(FAVORITE_REFERENCES_STORAGE_KEY);
    expect(entry?.idField).toBe("id");
    expect(entry?.section).toBe("Research");
  });

  it("explains the empty state", async () => {
    await render();
    expect(container!.textContent).toContain("No favorite references yet");
  });

  it("lists the starred references, newest first, with their link and the docs page", async () => {
    toggleFavoriteReference(toFavoriteReference(reference("Older citation.", "https://a.example/x"), "/docs/one", 1));
    toggleFavoriteReference(toFavoriteReference(reference("Newer citation."), "/docs/two", 2));
    await render();
    const rows = [...container!.querySelectorAll("li[data-favorite-reference]")];
    expect(rows.map((row) => row.querySelector("p")!.textContent)).toEqual(["Newer citation.", "Older citation."]);
    expect(rows[1]!.querySelector<HTMLAnchorElement>("a[href='https://a.example/x']")!.textContent).toContain("a.example");
    expect(rows[0]!.querySelector<HTMLAnchorElement>("a[href='/docs/two']")).not.toBeNull();
  });

  it("removes a favorite and follows a star added elsewhere", async () => {
    toggleFavoriteReference(toFavoriteReference(reference("First.")));
    await render();
    await act(async () => {
      toggleFavoriteReference(toFavoriteReference(reference("Second.")));
    });
    expect(container!.querySelectorAll("li[data-favorite-reference]")).toHaveLength(2);

    await act(async () => container!.querySelector<HTMLButtonElement>("li button[aria-label='Remove from favorites']")!.click());
    expect(container!.querySelectorAll("li[data-favorite-reference]")).toHaveLength(1);
    expect(readFavoriteReferences()).toHaveLength(1);
  });

  it("tells a guest the favorites stay in this browser and a signed-in user they are saved to the account", async () => {
    await render();
    expect(container!.textContent).toContain("they stay in this browser");
    await act(async () => root!.unmount());
    root = null;
    container!.remove();
    authenticated = true;
    await render();
    expect(container!.textContent).toContain("saved to your account");
  });
});
