

export const index = 1;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/fallbacks/error.svelte.js')).default;
export const imports = ["_app/immutable/nodes/1.ccdc2f40.js","_app/immutable/chunks/index.13108eec.js","_app/immutable/chunks/stores.14178e32.js","_app/immutable/chunks/singletons.32b3f4f7.js","_app/immutable/chunks/index.889e570a.js"];
export const stylesheets = [];
export const fonts = [];
