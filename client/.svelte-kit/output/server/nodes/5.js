

export const index = 5;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/auth/_page.svelte.js')).default;
export const imports = ["_app/immutable/nodes/5.ef921499.js","_app/immutable/chunks/index.bc524795.js"];
export const stylesheets = [];
export const fonts = [];
