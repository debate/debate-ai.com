

export const index = 6;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/auth/register/_page.svelte.js')).default;
export const imports = ["_app/immutable/nodes/6.c93f1094.js","_app/immutable/chunks/index.bc524795.js","_app/immutable/chunks/pocketbase.f2e61b4c.js","_app/immutable/chunks/index.ae762af0.js","_app/immutable/chunks/Button.15122d6b.js"];
export const stylesheets = [];
export const fonts = [];
