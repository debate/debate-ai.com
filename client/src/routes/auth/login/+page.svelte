<script lang="ts">
    import { currentUser, pb } from "../../../pocketbase";
    import Button from "$lib/Button.svelte";

    let username: string;
    let password: string;

    let loading: boolean;

    async function login() {
        const authData = await pb.collection('users').authWithOAuth2({ provider: 'google' });


    }

    function signOut() {
        pb.authStore.clear();
    }
</script>


<div class="sm:hidden inline-block relative h-[20rem] w-full">
    <img class="w-full h-full object-cover" src="/backdrop2.png" alt="desert scene">
    <div class="absolute left-0 top-0 w-full h-full bg-black/[0.15]"></div>
</div>
<div class="bg-[#363636] text-white sm:rounded-md p-8 sm:w-[500px] w-full drop-shadow-md h-full sm:h-auto sm:mt-0 z-10 select-none">
        <Button label="Sign in" onClick={login} loading={loading}/>
    <p class="text-sm text-[#B1B1B1] text-center">Need an account? <a class="text-[#65C0BD] font-semibold underline" href="/auth/register">Sign up Now</a></p>
</div>
<p class="hidden sm:inline-block text-sm text-center absolute left-1/2 bottom-4 -translate-x-1/2 text-white">By continuing you agree to the <span class="underline">Terms of Service</span> and <span class="underline">Privacy Policy</span></p>
