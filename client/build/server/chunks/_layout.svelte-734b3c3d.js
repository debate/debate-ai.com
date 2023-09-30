import { c as create_ssr_component, a as validate_store, b as subscribe, v as validate_component, d as add_attribute, e as escape } from './index3-6584cb50.js';
import { c as currentUser, g as getImageURL, p as pb } from './pocketbase-50230876.js';
import 'pocketbase';
import './index2-add8b348.js';

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
const Layout = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let $currentUser, $$unsubscribe_currentUser;
  validate_store(currentUser, "currentUser");
  $$unsubscribe_currentUser = subscribe(currentUser, (value) => $currentUser = value);
  let showProfileDropdown = false;
  let showAlertDropdown = false;
  function toggleAlertDropdown() {
    showProfileDropdown = false;
    showAlertDropdown = !showAlertDropdown;
  }
  function logout() {
    pb.authStore.clear();
  }
  function dropDownClicked(dropdown) {
    if (dropdown == 2)
      logout();
  }
  $$unsubscribe_currentUser();
  return `<header class="fixed w-full bg-[#2E2E2E] text-white h-14 flex justify-between items-center px-6 drop-shadow-md z-20">${$currentUser ? `
		<p class="text-neutral-500 text-sm text-center"></p>
		<div class="relative flex space-x-3 items-center group">${validate_component(CircleIcon, "CircleIcon").$$render(
    $$result,
    {
      icon: "bell",
      notifications: $currentUser?.alerts ? 1 : 0,
      onClick: () => {
        toggleAlertDropdown();
      }
    },
    {},
    {}
  )}
			<div class="relative group"><button><img${add_attribute(
    "src",
    $currentUser?.avatar ? getImageURL($currentUser?.collectionId, $currentUser?.id || "", $currentUser?.avatar) : "/profile.svg",
    0
  )} alt="Default profile" class="h-10 w-10 object-cover bg-white rounded-full">
					<div class="absolute -right-[2px] -bottom-[2px] border-[#2E2E2E] border-2 w-4 h-4 bg-neutral-700 rounded-full flex justify-center items-center group-hover:bg-neutral-600"><img src="chevron.svg" alt="chevron down" class="w-2"></div></button>

				${showAlertDropdown ? `${validate_component(MediumDropdown, "MediumDropdown").$$render($$result, { label: "Notifications" }, {}, {
    default: () => {
      return `${$currentUser?.alerts ? `<div class="flex items-center justify-between hover:bg-neutral-600 p-2 rounded-md select-none"><div class="flex items-center space-x-2"><div class="w-9 h-9 rounded-full bg-maroon-400 flex justify-center items-center bg-emerald-500"><img src="/confetti.svg" alt="kaboom" class="w-5"></div>
									<p class="text-sm font-semibold">${escape($currentUser?.alerts)}</p></div>
								<button><img src="/close.svg" alt="close that" class="w-3 hover:cursor-pointer"></button></div>` : `<p class="text-center text-neutral-300 font-semibold mb-4">Nothing to see here...</p>`}`;
    }
  })}` : ``}
				${showProfileDropdown ? `${validate_component(Dropdown, "Dropdown").$$render(
    $$result,
    {
      username: $currentUser.username,
      avatar: $currentUser?.avatar ? getImageURL($currentUser?.collectionId, $currentUser?.id || "", $currentUser?.avatar) : "/profile.svg",
      onClick: (num) => dropDownClicked(num),
      onEditProfile: () => window.location.assign(`http://${window.location.host}/user/${$currentUser?.id}`)
    },
    {},
    {}
  )}` : ``}</div></div>` : `<button class="bg-[#378E8B] p-3 rounded-[4px] font-semibold mt-5 mb-3">Sign in
		</button>`}

	
<div id="g_id_onload" data-client_id="140048034662-4qpof7rqqbhvshf1uvsm1vreko6n5na9.apps.googleusercontent.com" data-login_uri="https://app.debate.com.co" data-auto_prompt="false"></div>  

<div class="g_id_signin" data-type="standard" data-size="large" data-theme="outline" data-text="sign_in_with" data-shape="rectangular" data-logo_alignment="left"></div></header>

${$$result.head += `<!-- HEAD_svelte-184f6ec_START --><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous"><script src="https://accounts.google.com/gsi/client" async><\/script><link href="https://fonts.googleapis.com/css2?family=Roboto&display=swap" rel="stylesheet"><!-- HEAD_svelte-184f6ec_END -->`, ""}

<main class="relative pt-14">${slots.default ? slots.default({}) : ``}</main>`;
});

export { Layout as default };
//# sourceMappingURL=_layout.svelte-734b3c3d.js.map
