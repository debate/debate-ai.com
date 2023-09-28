import { c as create_ssr_component, d as add_attribute, v as validate_component } from "../../../../chunks/index2.js";
import { p as pb } from "../../../../chunks/pocketbase.js";
import { B as Button } from "../../../../chunks/Button.js";
const Page = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let email;
  let username;
  let password;
  let loading;
  async function login() {
    try {
      await pb.collection("users").authWithPassword(username, password);
      window.location.assign(`http://${window.location.host}/home`);
    } catch (err) {
      console.error(err);
      alert(err);
      pb.cancelAllRequests();
      loading = false;
    }
  }
  async function signUp() {
    try {
      const data = {
        username,
        password,
        email,
        passwordConfirm: password,
        alerts: "Welcome to [placeholder]!"
      };
      loading = true;
      const createdUser = await pb.collection("users").create(data);
      await login();
      loading = false;
    } catch (err) {
      console.error(err);
      alert(err);
      pb.cancelAllRequests();
      loading = false;
    }
  }
  return `<div class="sm:hidden inline-block relative h-[20rem] w-full"><img class="w-full h-full object-cover" src="/backdrop2.png" alt="desert scene">
    <div class="absolute left-0 top-0 w-full h-full bg-black/[0.15]"></div></div>
<div class="bg-[#363636] text-white sm:rounded-md p-8 sm:w-[500px] w-full drop-shadow-md h-full sm:h-auto sm:mt-0 z-10 select-none"><h2 class="mt-2 sm:mt-0 text-xl sm:text-2xl font-semibold text-center mb-5">Create an Account</h2>
    <form class="flex flex-col"><label for="email" class="text-[#C3C3C3] font-semibold mb-2 text-sm">Email</label>
        <input placeholder="" type="email" class="bg-[#232323] p-2 rounded-[4px] mb-4"${add_attribute("value", email, 0)}>
        <label for="username" class="text-[#C3C3C3] font-semibold mb-2 text-sm">Username</label>
        <input placeholder="" type="text" class="bg-[#232323] p-2 rounded-[4px] mb-4"${add_attribute("value", username, 0)}>
        <label for="password" class="text-[#C3C3C3] font-semibold mb-2 text-sm">Password</label>
        <input placeholder="" type="password" class="bg-[#232323] p-2 rounded-[4px] mb-4"${add_attribute("value", password, 0)}>
        
        ${validate_component(Button, "Button").$$render(
    $$result,
    {
      label: "Continue",
      onClick: signUp,
      loading
    },
    {},
    {}
  )}</form>
    <p class="text-sm text-[#B1B1B1] text-center">Have an account? <a class="text-[#65C0BD] font-semibold underline" href="/auth/login">Sign in Now</a></p></div>
<p class="hidden sm:inline-block text-sm text-center absolute left-1/2 bottom-4 -translate-x-1/2 text-white">By continuing you agree to the <span class="underline">Terms of Service</span> and <span class="underline">Privacy Policy</span></p>`;
});
export {
  Page as default
};
