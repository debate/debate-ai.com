import { c as create_ssr_component, a as validate_store, b as subscribe, v as validate_component, d as add_attribute, e as escape } from "../../../chunks/index2.js";
/* empty css                   */import { c as currentUser, g as getImageURL, p as pb } from "../../../chunks/pocketbase.js";
import { C as CircleIcon, M as MediumDropdown, D as Dropdown } from "../../../chunks/MediumDropdown.js";
const Layout = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let $currentUser, $$unsubscribe_currentUser;
  validate_store(currentUser, "currentUser");
  $$unsubscribe_currentUser = subscribe(currentUser, (value) => $currentUser = value);
  let showProfileDropdown = false;
  let showAlertDropdown = false;
  let showChatsDropdown = false;
  function toggleAlertDropdown() {
    showProfileDropdown = false;
    showChatsDropdown = false;
    showAlertDropdown = !showAlertDropdown;
  }
  function toggleChatsDropdown() {
    showProfileDropdown = false;
    showAlertDropdown = false;
    showChatsDropdown = !showChatsDropdown;
  }
  function logout() {
    pb.authStore.clear();
    window.location.assign(`http://${window.location.host}/auth`);
  }
  function dropDownClicked(dropdown) {
    if (dropdown == 2)
      logout();
  }
  $$unsubscribe_currentUser();
  return `<header class="fixed w-full bg-[#2E2E2E] text-white h-14 flex justify-between items-center px-6 drop-shadow-md z-20">${$currentUser ? `<button><img src="/placeholder-logo.svg" alt="Placeholder logo" class="h-8"></button>
		<p class="text-neutral-500 text-sm text-center">This is a mock social media site for testing
		</p>
		<div class="relative flex space-x-3 items-center group">${validate_component(CircleIcon, "CircleIcon").$$render(
    $$result,
    {
      icon: "message",
      onClick: () => {
        toggleChatsDropdown();
      }
    },
    {},
    {}
  )}
			${validate_component(CircleIcon, "CircleIcon").$$render(
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
					<div class="absolute -right-[2px] -bottom-[2px] border-[#2E2E2E] border-2 w-4 h-4 bg-neutral-700 rounded-full flex justify-center items-center group-hover:bg-neutral-600"><img src="/chevron.svg" alt="chevron down" class="w-2"></div></button>

				${showAlertDropdown ? `${validate_component(MediumDropdown, "MediumDropdown").$$render($$result, { label: "Notifications" }, {}, {
    default: () => {
      return `${$currentUser?.alerts ? `<div class="flex items-center justify-between hover:bg-neutral-600 p-2 rounded-md select-none"><div class="flex items-center space-x-2"><div class="w-9 h-9 rounded-full bg-maroon-400 flex justify-center items-center bg-emerald-500"><img src="/confetti.svg" alt="kaboom" class="w-5"></div>
									<p class="text-sm font-semibold">${escape($currentUser?.alerts)}</p></div>
								<button><img src="/close.svg" alt="close that" class="w-3 hover:cursor-pointer"></button></div>` : `<p class="text-center text-neutral-300 font-semibold mb-4">Nothing to see here...</p>`}`;
    }
  })}` : ``}
				${showChatsDropdown ? `${validate_component(MediumDropdown, "MediumDropdown").$$render($$result, { label: "Chats" }, {}, {
    default: () => {
      return `<p class="text-center text-neutral-300 font-semibold mb-4">Coming Soon™</p>`;
    }
  })}` : ``}
				${showProfileDropdown ? `${validate_component(Dropdown, "Dropdown").$$render(
    $$result,
    {
      avatar: $currentUser?.avatar ? getImageURL($currentUser?.collectionId, $currentUser?.id || "", $currentUser?.avatar) : "/profile.svg",
      username: $currentUser.username,
      onClick: (num) => dropDownClicked(num),
      onEditProfile: () => window.location.assign(`http://${window.location.host}/user/${$currentUser?.id}`)
    },
    {},
    {}
  )}` : ``}</div></div>` : ``}</header>
<main>${slots.default ? slots.default({}) : ``}</main>`;
});
export {
  Layout as default
};
