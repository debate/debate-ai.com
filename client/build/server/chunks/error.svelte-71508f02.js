import { c as create_ssr_component, a as validate_store, b as subscribe, e as escape } from './index3-6584cb50.js';
import { p as page } from './stores-f099c850.js';

const Error = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let $page, $$unsubscribe_page;
  validate_store(page, "page");
  $$unsubscribe_page = subscribe(page, (value) => $page = value);
  $$unsubscribe_page();
  return `<h1>${escape($page.status)}</h1>
<p>${escape($page.error?.message)}</p>`;
});

export { Error as default };
//# sourceMappingURL=error.svelte-71508f02.js.map
