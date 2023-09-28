

export const index = 1;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/fallbacks/error.svelte.js')).default;
export const imports = ["_app/immutable/nodes/1.c996891f.js","_app/immutable/chunks/index.bc524795.js","_app/immutable/chunks/stores.518ce552.js","_app/immutable/chunks/singletons.94755e63.js","_app/immutable/chunks/index.ae762af0.js"];
export const stylesheets = [];
export const fonts = [];
