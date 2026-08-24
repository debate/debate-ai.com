// The card-cutter package is loaded only for its registration side
// effect (window.__registerCardCutter); the app never uses its
// exports, so an opaque ambient module keeps TS happy whether the
// alias resolves to the real package or the in-repo no-op stub.
declare module '@cardcutter/browser';
