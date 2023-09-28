import { c as create_ssr_component, e as escape } from "./index2.js";
const Button = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { onClick } = $$props;
  let { label } = $$props;
  let { loading } = $$props;
  if ($$props.onClick === void 0 && $$bindings.onClick && onClick !== void 0)
    $$bindings.onClick(onClick);
  if ($$props.label === void 0 && $$bindings.label && label !== void 0)
    $$bindings.label(label);
  if ($$props.loading === void 0 && $$bindings.loading && loading !== void 0)
    $$bindings.loading(loading);
  return `<button class="bg-[#378E8B] p-3 rounded-[4px] font-semibold mt-5 mb-3">${loading ? `<img class="w-6 animate-spin mx-auto" src="/spinner.svg" alt="loading spinner">` : `${escape(label)}`}</button>`;
});
export {
  Button as B
};
