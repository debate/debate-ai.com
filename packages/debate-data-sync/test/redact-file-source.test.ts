/**
 * @fileoverview Pins `redactFileSource`, the one collection-specific `redact`
 * in the catalog: what it strips from each `FileSourceType`'s `credentials`
 * before a File Sources record is allowed to reach the account, and that it
 * leaves anything not shaped like a File Sources record alone.
 */

import { describe, it, expect } from "vitest";
import { redactFileSource } from "../src/state/redact-file-source";

describe("redactFileSource", () => {
  it("drops the local source's absent credentials without complaint", () => {
    const source = {
      id: "local-default",
      name: "Local Files",
      type: "local",
      isDefault: true,
    };

    expect(redactFileSource(source)).toEqual(source);
  });

  it("keeps host/port/username, drops password/privateKey/passphrase for an SSH source", () => {
    const source = {
      id: "ssh-1",
      name: "My server",
      type: "ssh",
      credentials: {
        host: "example.com",
        port: 22,
        username: "alex",
        password: "hunter2",
        privateKey: "-----BEGIN KEY-----",
        passphrase: "let-me-in",
        basePath: "/home/alex",
      },
    };

    expect(redactFileSource(source)).toEqual({
      id: "ssh-1",
      name: "My server",
      type: "ssh",
      credentials: { host: "example.com", port: 22, username: "alex", basePath: "/home/alex" },
    });
  });

  it("keeps region/bucket/endpoint, drops accessKeyId/secretAccessKey for an S3 source", () => {
    const source = {
      id: "s3-1",
      name: "My bucket",
      type: "s3",
      credentials: {
        accessKeyId: "AKIA...",
        secretAccessKey: "shh",
        region: "us-east-1",
        bucket: "my-bucket",
        endpoint: "https://s3.example.com",
        basePath: "docs",
      },
    };

    expect(redactFileSource(source)).toEqual({
      id: "s3-1",
      name: "My bucket",
      type: "s3",
      credentials: {
        region: "us-east-1",
        bucket: "my-bucket",
        endpoint: "https://s3.example.com",
        basePath: "docs",
      },
    });
  });

  it("keeps accountId/bucket, drops accessKeyId/secretAccessKey for an R2 source", () => {
    const source = {
      id: "r2-1",
      name: "My R2",
      type: "r2",
      credentials: {
        accountId: "acct-1",
        accessKeyId: "id",
        secretAccessKey: "shh",
        bucket: "my-bucket",
      },
    };

    expect(redactFileSource(source)).toEqual({
      id: "r2-1",
      name: "My R2",
      type: "r2",
      credentials: { accountId: "acct-1", bucket: "my-bucket" },
    });
  });

  it("keeps bucket/endpoint, drops accessKeyId/secretAccessKey for a B2 source", () => {
    const source = {
      id: "b2-1",
      name: "My B2",
      type: "b2",
      credentials: {
        accessKeyId: "id",
        secretAccessKey: "shh",
        bucket: "my-bucket",
        endpoint: "https://s3.us-west-004.backblazeb2.com",
      },
    };

    expect(redactFileSource(source)).toEqual({
      id: "b2-1",
      name: "My B2",
      type: "b2",
      credentials: { bucket: "my-bucket", endpoint: "https://s3.us-west-004.backblazeb2.com" },
    });
  });

  it("keeps email/folderIds/isAuthenticated, drops accessToken/refreshToken for a Google Docs source", () => {
    const source = {
      id: "gdocs-1",
      name: "My Drive",
      type: "gdocs",
      credentials: {
        accessToken: "at",
        refreshToken: "rt",
        email: "alex@example.com",
        folderIds: ["f1", "f2"],
        isAuthenticated: true,
      },
    };

    expect(redactFileSource(source)).toEqual({
      id: "gdocs-1",
      name: "My Drive",
      type: "gdocs",
      credentials: { email: "alex@example.com", folderIds: ["f1", "f2"], isAuthenticated: true },
    });
  });

  it("keeps endpoint/database/enableGoogleDocsSync, drops authToken for a Turso source", () => {
    const source = {
      id: "turso-1",
      name: "My Turso DB",
      type: "turso",
      credentials: {
        endpoint: "libsql://my-db.turso.io",
        authToken: "shh",
        database: "my-db",
        enableGoogleDocsSync: false,
      },
    };

    expect(redactFileSource(source)).toEqual({
      id: "turso-1",
      name: "My Turso DB",
      type: "turso",
      credentials: {
        endpoint: "libsql://my-db.turso.io",
        database: "my-db",
        enableGoogleDocsSync: false,
      },
    });
  });

  it("holds back every credential field for an unrecognized source type, rather than guessing", () => {
    const source = {
      id: "mystery-1",
      name: "Something new",
      type: "not-a-real-type",
      credentials: { anything: "goes", password: "hunter2" },
    };

    expect(redactFileSource(source)).toEqual({
      id: "mystery-1",
      name: "Something new",
      type: "not-a-real-type",
      credentials: {},
    });
  });

  it("holds back every credential field when the record carries no (or a non-string) type", () => {
    // The same "don't guess" rule as an unrecognized type string, for a
    // record whose `type` is missing or isn't a string at all.
    expect(redactFileSource({ id: "a", credentials: { password: "hunter2" } })).toEqual({
      id: "a",
      credentials: {},
    });
    expect(redactFileSource({ id: "a", type: 42, credentials: { password: "hunter2" } })).toEqual({
      id: "a",
      type: 42,
      credentials: {},
    });
  });

  it("passes through a record with no credentials object to redact", () => {
    expect(redactFileSource({ id: "a", name: "n", type: "s3" })).toEqual({
      id: "a",
      name: "n",
      type: "s3",
    });
    expect(redactFileSource({ id: "a", credentials: "not-an-object" })).toEqual({
      id: "a",
      credentials: "not-an-object",
    });
    expect(redactFileSource({ id: "a", credentials: null })).toEqual({ id: "a", credentials: null });
  });

  it("passes through anything that isn't a plain object, unchanged", () => {
    expect(redactFileSource(null)).toBeNull();
    expect(redactFileSource(undefined)).toBeUndefined();
    expect(redactFileSource("not an object")).toBe("not an object");
    expect(redactFileSource(42)).toBe(42);
    expect(redactFileSource(["array", "not", "record"])).toEqual(["array", "not", "record"]);
  });
});
