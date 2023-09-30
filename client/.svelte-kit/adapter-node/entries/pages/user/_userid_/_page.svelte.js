import { c as create_ssr_component, b as validate_store, d as subscribe } from "../../../../chunks/index3.js";
import { c as currentUser } from "../../../../chunks/pocketbase.js";
import { p as page } from "../../../../chunks/stores.js";
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
export {
  Page as default
};
