import { c as create_ssr_component, e as escape, d as add_attribute, v as validate_component } from "./index2.js";
const CircleIcon = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { icon } = $$props;
  let { notifications = 0 } = $$props;
  let { onClick } = $$props;
  if ($$props.icon === void 0 && $$bindings.icon && icon !== void 0)
    $$bindings.icon(icon);
  if ($$props.notifications === void 0 && $$bindings.notifications && notifications !== void 0)
    $$bindings.notifications(notifications);
  if ($$props.onClick === void 0 && $$bindings.onClick && onClick !== void 0)
    $$bindings.onClick(onClick);
  return `<button class="relative h-10 w-10 bg-neutral-600 rounded-full flex justify-center items-center hover:bg-neutral-500">${notifications ? `<div class="absolute w-5 h-5 -top-1 -right-2 bg-red-600 text-xs font-semibold rounded-full drop-shadow-sm flex justify-center items-center"><p>${escape(notifications)}</p></div>` : ``}
    <img src="${"/" + escape(icon, true) + ".svg"}" alt="Bell" class="w-4"></button>`;
});
const DropdownOption = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { icon } = $$props;
  let { label } = $$props;
  let { onClick } = $$props;
  let { showArrow = false } = $$props;
  if ($$props.icon === void 0 && $$bindings.icon && icon !== void 0)
    $$bindings.icon(icon);
  if ($$props.label === void 0 && $$bindings.label && label !== void 0)
    $$bindings.label(label);
  if ($$props.onClick === void 0 && $$bindings.onClick && onClick !== void 0)
    $$bindings.onClick(onClick);
  if ($$props.showArrow === void 0 && $$bindings.showArrow && showArrow !== void 0)
    $$bindings.showArrow(showArrow);
  return `<button class="hover:bg-neutral-600 p-2 rounded-md flex items-center justify-between w-full"><div class="flex items-center"><div class="w-8 h-8 rounded-full bg-neutral-600 mr-3 flex justify-center items-center"><img src="${"/" + escape(icon, true) + ".svg"}" alt="Supporting Icon" class="w-5"></div>
		<p class="font-semibold text-neutral-200">${escape(label)}</p></div>
	${showArrow ? `<img src="/chevron-right.svg" alt="Right Arrow" class="h-4">` : ``}</button>`;
});
const Dropdown = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { avatar } = $$props;
  let { username } = $$props;
  let { onClick } = $$props;
  let { onEditProfile } = $$props;
  if ($$props.avatar === void 0 && $$bindings.avatar && avatar !== void 0)
    $$bindings.avatar(avatar);
  if ($$props.username === void 0 && $$bindings.username && username !== void 0)
    $$bindings.username(username);
  if ($$props.onClick === void 0 && $$bindings.onClick && onClick !== void 0)
    $$bindings.onClick(onClick);
  if ($$props.onEditProfile === void 0 && $$bindings.onEditProfile && onEditProfile !== void 0)
    $$bindings.onEditProfile(onEditProfile);
  return `<div class="bg-[#2E2E2E] rounded-md drop-shadow-md absolute w-72 left-full -translate-x-72 p-4"><button class="flex items-center mb-4 border-b-[1px] border-neutral-600 hover:bg-neutral-600 hover:rounded-md p-2 transition-colors duration-100 w-full"><img${add_attribute("src", avatar || "/profile.svg", 0)} alt="Profile Icon" class="h-10 w-10 object-cover bg-white rounded-full mr-3">
		<p class="font-semibold text-lg capitalize">${escape(username)}</p>
		<p class="text-sm text-emerald-300 flex-1 text-right">Edit Profile</p></button>
	${validate_component(DropdownOption, "DropdownOption").$$render(
    $$result,
    {
      label: "Settings",
      showArrow: true,
      icon: "gear",
      onClick: () => onClick(0)
    },
    {},
    {}
  )}
	${validate_component(DropdownOption, "DropdownOption").$$render(
    $$result,
    {
      label: "Help",
      showArrow: true,
      icon: "help",
      onClick: () => onClick(1)
    },
    {},
    {}
  )}
	${validate_component(DropdownOption, "DropdownOption").$$render(
    $$result,
    {
      label: "Log Out",
      icon: "sign-out",
      onClick: () => onClick(2)
    },
    {},
    {}
  )}</div>`;
});
const MediumDropdown = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { label } = $$props;
  if ($$props.label === void 0 && $$bindings.label && label !== void 0)
    $$bindings.label(label);
  return `<div class="bg-[#2E2E2E] rounded-md drop-shadow-md absolute w-72 left-full -translate-x-72 p-4"><div class="flex justify-between mb-4 mx-2"><h4 class="text-lg font-semibold">${escape(label)}</h4>
		<img src="/dots.svg" alt="dot dot dot" class="w-4"></div>
	${slots.default ? slots.default({}) : ``}</div>`;
});
export {
  CircleIcon as C,
  Dropdown as D,
  MediumDropdown as M
};
