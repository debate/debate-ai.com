import { c as create_ssr_component } from "../../../chunks/index2.js";
/* empty css                   */const _layout_svelte_svelte_type_style_lang = "";
const css = {
  code: "main.s-YUYvuQqcEkKT{background:url(/backdrop.png) no-repeat center center fixed;background-size:cover;background-attachment:fixed;position:absolute;left:0;top:0;width:100%;height:100%}",
  map: null
};
const Layout = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  $$result.css.add(css);
  return `<main class="s-YUYvuQqcEkKT"><div class="flex justify-center items-center bg-black/10 h-screen flex-col">${slots.default ? slots.default({}) : ``}</div></main>`;
});
export {
  Layout as default
};
