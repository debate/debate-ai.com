

export const index = 8;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/home/_page.svelte.js')).default;
export const imports = ["_app/immutable/nodes/8.863224bf.js","_app/immutable/chunks/index.bc524795.js","_app/immutable/chunks/pocketbase.f2e61b4c.js","_app/immutable/chunks/index.ae762af0.js","_app/immutable/chunks/HoverDropdown.b15a08e3.js"];
export const stylesheets = [];
export const fonts = [];
