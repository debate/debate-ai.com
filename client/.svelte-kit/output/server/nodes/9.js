

export const index = 9;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/user/_userid_/_page.svelte.js')).default;
export const imports = ["_app/immutable/nodes/9.c4db9207.js","_app/immutable/chunks/index.bc524795.js","_app/immutable/chunks/pocketbase.f2e61b4c.js","_app/immutable/chunks/index.ae762af0.js","_app/immutable/chunks/stores.518ce552.js","_app/immutable/chunks/singletons.94755e63.js","_app/immutable/chunks/HoverDropdown.b15a08e3.js"];
export const stylesheets = [];
export const fonts = [];
