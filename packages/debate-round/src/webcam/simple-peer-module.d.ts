// simple-peer's prebuilt browser bundle: self-contained (no Node `Buffer`/
// `process`/`events` polyfills needed by the bundler), same API as the package.
declare module "simple-peer/simplepeer.min.js" {
  import SimplePeer from "simple-peer"
  export default SimplePeer
}
