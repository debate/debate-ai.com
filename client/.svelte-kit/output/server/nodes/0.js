

export const index = 0;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/fallbacks/layout.svelte.js')).default;
export const imports = ["_app/immutable/nodes/0.6d5bf454.js","_app/immutable/chunks/index.bc524795.js"];
export const stylesheets = [];
export const fonts = [];
