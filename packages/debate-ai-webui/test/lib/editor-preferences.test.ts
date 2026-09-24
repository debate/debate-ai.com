/**
 * @fileoverview Pins what `/settings` hosts and what of it reaches the
 * account.
 *
 * The page is the CardMirror editor's settings surface now — its whole tab
 * set, not the three categories that first moved out of the editor's modal —
 * so the allow-list a `PUT /api/settings` patch is checked against has to
 * cover every one of those categories. The credentials among them must not
 * come with it: an API key or a relay token is a secret this browser holds,
 * and a mirror that carried it would put it in a server row (and hand it back
 * to every other device on the account).
 */

import { describe, expect, it } from "vitest";
import { CATEGORY_TABS } from "debate-editor/settings-categories";
import { SETTING_METADATA } from "debate-editor/settings";

import {
  EDITOR_PREFERENCE_KEYS,
  EDITOR_SETTINGS_TABS,
  normalizeEditorPreferencesPatch,
  parseEditorPreferences,
} from "../editor-preferences";

/** Credentials, which the page may render but never mirrors. */
const CREDENTIAL_KEYS = [
  "anthropicApiKey",
  "openrouterApiKey",
  "googleTranslateApiKey",
  "myMemoryEmail",
  "pairingRelayToken",
];

describe("EDITOR_SETTINGS_TABS", () => {
  it("carries every tab the editor's own modal shows, with its label", () => {
    // Drift guard: a category added to the editor's settings dialog should
    // surface on this page too, rather than being reachable only in the
    // editor. `plugins` is the deliberate exception — see the tab list's own
    // comment.
    for (const tab of CATEGORY_TABS) {
      if (tab.id === "plugins") continue;
      expect(EDITOR_SETTINGS_TABS).toContainEqual({ id: tab.id, label: tab.label });
    }
  });

  it("adds the two tabs that live only here", () => {
    // Appearance and Accessibility were dropped from the editor's modal when
    // they moved to this page, so it is the only place they render.
    expect(EDITOR_SETTINGS_TABS.map((tab) => tab.id)).toContain("appearance");
    expect(EDITOR_SETTINGS_TABS.map((tab) => tab.id)).toContain("accessibility");
  });

  it("leaves out the desktop-only plugins tab, which would render empty", () => {
    expect(EDITOR_SETTINGS_TABS.map((tab) => tab.id)).not.toContain("plugins");
  });
});

describe("EDITOR_PREFERENCE_KEYS", () => {
  it("covers every non-credential setting in every hosted category", () => {
    const hosted = EDITOR_SETTINGS_TABS.map((tab) => tab.id);
    const expected = SETTING_METADATA.filter(
      (meta) => hosted.includes(meta.category) && !CREDENTIAL_KEYS.includes(meta.key),
    ).map((meta) => meta.key);

    expect(expected.length).toBeGreaterThan(100);
    for (const key of expected) expect(EDITOR_PREFERENCE_KEYS.has(key)).toBe(true);
  });

  it("reaches the categories that used to stay in the editor's modal", () => {
    // One representative row per newly mirrored category.
    for (const key of ["defaultSaveFormat", "smartQuotes", "ribbonKeyOverrides", "aiFeaturesEnabled", "pairingEnabled"]) {
      expect(EDITOR_PREFERENCE_KEYS.has(key)).toBe(true);
    }
  });

  it("never carries a credential", () => {
    for (const key of CREDENTIAL_KEYS) expect(EDITOR_PREFERENCE_KEYS.has(key)).toBe(false);
  });

  it("leaves the plugins category out, tab and keys alike", () => {
    expect(EDITOR_PREFERENCE_KEYS.has("pluginsEnabled")).toBe(false);
  });
});

describe("a patch from the settings page", () => {
  it("accepts a hosted setting", () => {
    expect(normalizeEditorPreferencesPatch({ smartQuotes: false })).toEqual({
      valid: { smartQuotes: false },
      errors: [],
    });
  });

  it("rejects a credential as an unknown key rather than storing it", () => {
    const result = normalizeEditorPreferencesPatch({ anthropicApiKey: "sk-ant-secret" });
    expect(result.valid).toEqual({});
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("anthropicApiKey");
  });
});

describe("a stored row", () => {
  it("reads back a credential as absent, whatever the row holds", () => {
    // The allow-list filters on the way out as well as in, so a key that
    // predates it (or arrived some other way) never reaches a client.
    const stored = JSON.stringify({ smartQuotes: true, openrouterApiKey: "sk-or-secret" });
    expect(parseEditorPreferences(stored)).toEqual({ smartQuotes: true });
  });
});
