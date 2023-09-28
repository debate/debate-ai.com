

export const index = 4;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/user/_layout.svelte.js')).default;
export const imports = ["_app/immutable/nodes/4.132eb85b.js","_app/immutable/chunks/index.bc524795.js","_app/immutable/chunks/pocketbase.f2e61b4c.js","_app/immutable/chunks/index.ae762af0.js","_app/immutable/chunks/MediumDropdown.ffbc9ce1.js"];
export const stylesheets = ["_app/immutable/assets/app.d8abaefd.css"];
export const fonts = [];
