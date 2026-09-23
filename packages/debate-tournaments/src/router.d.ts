// `router` (Express's standalone router) ships no types; this package uses it
// only as an opaque middleware function (see api/express-adapter.ts).
declare module "router" {
  interface RouterOptions {
    caseSensitive?: boolean;
    mergeParams?: boolean;
    strict?: boolean;
  }
  interface RouterInstance {
    (req: unknown, res: unknown, done: (err?: unknown) => void): void;
    use(path: string, ...handlers: unknown[]): RouterInstance;
    use(...handlers: unknown[]): RouterInstance;
    route(path: string): Record<string, (...handlers: unknown[]) => unknown> & { openapi?: unknown };
  }
  function Router(options?: RouterOptions): RouterInstance;
  export default Router;
}
