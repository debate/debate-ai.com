/**
 * @fileoverview Covers reading the visitor's coarse location off an inbound
 * request. The properties worth pinning are that nothing here ever throws or
 * invents a value: a request with no Cloudflare metadata (local dev, a test,
 * a preview without the visitor-location transform) must resolve to all-null
 * rather than to `NaN` coordinates or a bogus `"XX"` country, because callers
 * branch on `null` to decide whether they have a location at all.
 */

import { describe, expect, it } from "vitest";

import {
  EMPTY_VISITOR_LOCATION,
  hasCoordinates,
  readVisitorLocation,
} from "../visitor-location";

/** A request carrying Cloudflare's `cf` object, as the Worker runtime provides it. */
function requestWithCf(cf: Record<string, unknown>): Request {
  const request = new Request("https://d.ebate.app/api/location");
  Object.defineProperty(request, "cf", { value: cf });
  return request;
}

/** A request carrying only the `cf-*` visitor-location headers. */
function requestWithHeaders(headers: Record<string, string>): Request {
  return new Request("https://d.ebate.app/api/location", { headers });
}

describe("readVisitorLocation", () => {
  it("reads every field from request.cf", () => {
    const location = readVisitorLocation(
      requestWithCf({
        city: "Sunnyvale",
        region: "California",
        country: "US",
        latitude: "37.36883",
        longitude: "-122.03615",
        timezone: "America/Los_Angeles",
      }),
    );

    expect(location).toEqual({
      city: "Sunnyvale",
      region: "California",
      country: "US",
      latitude: 37.36883,
      longitude: -122.03615,
      timezone: "America/Los_Angeles",
    });
  });

  it("falls back to the cf-* headers when there is no cf object", () => {
    const location = readVisitorLocation(
      requestWithHeaders({
        "cf-ipcity": "Austin",
        "cf-region": "Texas",
        "cf-ipcountry": "us",
        "cf-iplatitude": "30.26715",
        "cf-iplongitude": "-97.74306",
        "cf-timezone": "America/Chicago",
      }),
    );

    expect(location).toEqual({
      city: "Austin",
      region: "Texas",
      country: "US",
      latitude: 30.26715,
      longitude: -97.74306,
      timezone: "America/Chicago",
    });
  });

  it("fills in field by field, so a partial cf object is completed from headers", () => {
    const request = requestWithHeaders({
      "cf-iplatitude": "51.50853",
      "cf-iplongitude": "-0.12574",
    });
    Object.defineProperty(request, "cf", { value: { city: "London", country: "GB" } });

    expect(readVisitorLocation(request)).toMatchObject({
      city: "London",
      country: "GB",
      latitude: 51.50853,
      longitude: -0.12574,
    });
  });

  it("resolves to all-null for a request with no Cloudflare metadata", () => {
    expect(readVisitorLocation(new Request("http://localhost:3000/api/location"))).toEqual(
      EMPTY_VISITOR_LOCATION,
    );
  });

  it("treats Cloudflare's XX and T1 placeholders as no country", () => {
    expect(readVisitorLocation(requestWithCf({ country: "XX" })).country).toBeNull();
    expect(readVisitorLocation(requestWithCf({ country: "T1" })).country).toBeNull();
  });

  it("drops unparseable and out-of-range coordinates rather than passing on NaN", () => {
    const location = readVisitorLocation(
      requestWithCf({ latitude: "unknown", longitude: "512.5" }),
    );

    expect(location.latitude).toBeNull();
    expect(location.longitude).toBeNull();
  });

  it("drops blank strings, which the headers use for an unknown field", () => {
    const location = readVisitorLocation(
      requestWithHeaders({ "cf-ipcity": "   ", "cf-timezone": "" }),
    );

    expect(location.city).toBeNull();
    expect(location.timezone).toBeNull();
  });
});

describe("hasCoordinates", () => {
  it("is true only when both coordinates are present", () => {
    expect(hasCoordinates({ ...EMPTY_VISITOR_LOCATION, latitude: 1, longitude: 2 })).toBe(true);
    expect(hasCoordinates({ ...EMPTY_VISITOR_LOCATION, latitude: 1 })).toBe(false);
    expect(hasCoordinates({ ...EMPTY_VISITOR_LOCATION })).toBe(false);
    expect(hasCoordinates(null)).toBe(false);
  });

  it("is true at the equator and prime meridian, where the coordinates are 0", () => {
    expect(hasCoordinates({ ...EMPTY_VISITOR_LOCATION, latitude: 0, longitude: 0 })).toBe(true);
  });
});
