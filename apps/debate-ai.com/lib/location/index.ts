/**
 * Server-safe exports only. The browser-side lookup lives in
 * `./client` and is imported from there directly, so a route handler or the
 * Worker never pulls `grab-url` (and its `window` bootstrap) into the bundle.
 */
export {
  EMPTY_VISITOR_LOCATION,
  VISITOR_LOCATION_MAX_AGE_SECONDS,
  hasCoordinates,
  readVisitorLocation,
  type VisitorLocation,
} from "./visitor-location";
