import { c as create_ssr_component, a as validate_store, b as subscribe } from './index3-6584cb50.js';
import { c as currentUser } from './pocketbase-50230876.js';
import { p as page } from './stores-f099c850.js';
import 'pocketbase';
import './index2-add8b348.js';

const Page = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let $$unsubscribe_currentUser;
  let $$unsubscribe_page;
  validate_store(currentUser, "currentUser");
  $$unsubscribe_currentUser = subscribe(currentUser, (value) => value);
  validate_store(page, "page");
  $$unsubscribe_page = subscribe(page, (value) => value);
  $$unsubscribe_currentUser();
  $$unsubscribe_page();
  return `${``}`;
});

export { Page as default };
//# sourceMappingURL=_page.svelte-b8952f35.js.map
