import { describe, expect, it } from "vitest";
import {
  DEFAULT_MY_TEAM_PROFILE_SYNC,
  isValidMyTeamProfileSyncPayload,
  normalizeMyTeamProfilePatch,
  parseMyTeamProfile,
  serializeMyTeamProfile,
} from "../src/state/myTeamProfileSync";

describe("isValidMyTeamProfileSyncPayload", () => {
  it("accepts a well-formed profile", () => {
    expect(isValidMyTeamProfileSyncPayload({ school: "Lincoln HS", email1: "a@x.com", email2: "" })).toBe(true);
  });

  it("accepts all-empty fields", () => {
    expect(isValidMyTeamProfileSyncPayload({ school: "", email1: "", email2: "" })).toBe(true);
  });

  it("rejects a missing field", () => {
    expect(isValidMyTeamProfileSyncPayload({ school: "", email1: "" })).toBe(false);
  });

  it("rejects an unknown extra field", () => {
    expect(isValidMyTeamProfileSyncPayload({ school: "", email1: "", email2: "", extra: "x" })).toBe(false);
  });

  it("rejects a non-string field", () => {
    expect(isValidMyTeamProfileSyncPayload({ school: 1, email1: "", email2: "" })).toBe(false);
  });

  it("rejects a field longer than 200 characters", () => {
    expect(isValidMyTeamProfileSyncPayload({ school: "a".repeat(201), email1: "", email2: "" })).toBe(false);
  });

  it.each([null, undefined, "not an object", 5, ["array"]])("rejects a non-object value %p", (value) => {
    expect(isValidMyTeamProfileSyncPayload(value)).toBe(false);
  });
});

describe("normalizeMyTeamProfilePatch", () => {
  it("accepts a valid profile patch", () => {
    const result = normalizeMyTeamProfilePatch({
      myTeamProfile: { school: "MIT", email1: "a@mit.edu", email2: "b@mit.edu" },
    });
    expect(result).toEqual({
      valid: { myTeamProfile: { school: "MIT", email1: "a@mit.edu", email2: "b@mit.edu" } },
      errors: [],
    });
  });

  it("accepts null to clear the synced profile", () => {
    const result = normalizeMyTeamProfilePatch({ myTeamProfile: null });
    expect(result).toEqual({ valid: { myTeamProfile: null }, errors: [] });
  });

  it("ignores unknown top-level fields", () => {
    const result = normalizeMyTeamProfilePatch({ debateStyle: 1 });
    expect(result).toEqual({ valid: {}, errors: [] });
  });

  it("reports an error for a malformed profile", () => {
    const result = normalizeMyTeamProfilePatch({ myTeamProfile: { school: "x" } });
    expect(result.valid).toEqual({});
    expect(result.errors).toHaveLength(1);
  });

  it.each([null, undefined, "not an object", 5, ["array"]])("rejects a non-object body %p", (body) => {
    const result = normalizeMyTeamProfilePatch(body);
    expect(result.valid).toEqual({});
    expect(result.errors).toHaveLength(1);
  });

  it("returns no valid fields and no errors for an empty object", () => {
    expect(normalizeMyTeamProfilePatch({})).toEqual({ valid: {}, errors: [] });
  });
});

describe("serializeMyTeamProfile / parseMyTeamProfile", () => {
  it("round-trips a profile", () => {
    const profile = { school: "MIT", email1: "a@mit.edu", email2: "" };
    expect(parseMyTeamProfile(serializeMyTeamProfile(profile))).toEqual(profile);
  });

  it("serializes null as null", () => {
    expect(serializeMyTeamProfile(null)).toBeNull();
  });

  it.each([null, undefined, ""])("parses %p as null", (raw) => {
    expect(parseMyTeamProfile(raw)).toBeNull();
  });

  it("parses malformed JSON as null instead of throwing", () => {
    expect(parseMyTeamProfile("{not json")).toBeNull();
  });

  it("parses well-formed JSON with an invalid shape as null", () => {
    expect(parseMyTeamProfile(JSON.stringify({ school: "x" }))).toBeNull();
  });
});

describe("DEFAULT_MY_TEAM_PROFILE_SYNC", () => {
  it("defaults to no synced profile", () => {
    expect(DEFAULT_MY_TEAM_PROFILE_SYNC.myTeamProfile).toBeNull();
  });
});
