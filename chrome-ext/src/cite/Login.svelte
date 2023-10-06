<script lang="ts">
  import { onMount } from 'svelte';
  import { login as authLogin } from './arguflow';
  import TextButton from './TextButton.svelte';
  import Icon from './Icon.svelte';
  import { messenger } from './stores';

  export let closePopup: () => void;
  let emailInput: HTMLInputElement;
  let passwordInput: HTMLInputElement;
  let email = '';
  let password = '';
  onMount(function () {
    emailInput.focus();
    chrome.storage.local.get('arguflowLogin', (result) => {
      if (result.arguflowLogin) {
        email = result.arguflowLogin.email;
        password = result.arguflowLogin.password;
        passwordInput.focus();
      }
    });
  });

  let emailError = false;
  let passwordError = false;

  function login(email: string, password: string) {
    emailError = false;
    passwordError = false;
    // do basic validation
    if (email.length == 0) {
      emailError = true;
      messenger.addErrorMessage('Email is required');
    }
    if (password.length == 0) {
      passwordError = true;
      messenger.addErrorMessage('Password is required');
    }
    if (emailError || passwordError) {
      return;
    }
    // if resolve, close popup, else show error
    authLogin(email, password)
      .then(() => {
        messenger.addMessage('Logged in');
        closePopup();
      })
      .catch((err) => {
        emailError = true;
        passwordError = true;
        messenger.addError('login', err);
      });
  }
</script>

<h1>Login to Arguflow</h1>
<div class="content">
  <input
    bind:this={emailInput}
    type="text"
    placeholder="email"
    bind:value={email}
    class:invalid={emailError}
    on:keydown={(e) => {
      if (e.key == 'Enter') {
        passwordInput.focus();
      }
    }}
  />
  <input
    bind:this={passwordInput}
    type="password"
    placeholder="password"
    bind:value={password}
    class:invalid={passwordError}
    on:keydown={(e) => {
      if (e.key == 'Enter') {
        login(email, password);
      }
    }}
  />
  <div class="buttons">
    <TextButton
      on:click={() => {
        login(email, password);
      }}
    >
      Login
    </TextButton>
    <span>or</span>
    <TextButton
      on:click={() => {
        window.open('https://vault.arguflow.ai/auth/register', '_blank');
      }}
    >
      <span>Register</span>
      <Icon name="popout" />
    </TextButton>
  </div>
</div>

<style>
  h1 {
    margin: 0;
    font-weight: bold;
    font-size: 1rem;
    padding: var(--padding-big) var(--padding-big) 0 var(--padding-big);
  }
  .content {
    height: 100%;
    overflow: scroll;
    box-sizing: border-box;
    padding: 0 var(--padding-big) var(--padding-big) var(--padding-big);
    display: flex;
    flex-direction: column;
    gap: var(--padding);
  }
  .buttons {
    display: flex;
    flex-direction: row;
    gap: var(--padding);
    align-items: center;
    justify-content: center;
  }
  a {
    color: inherit;
    text-decoration: none;
  }

  input {
    border: none;
    outline: none;
    display: block;
    box-sizing: border-box;
    position: relative;
    width: 100%;
    font-size: inherit;
    font-weight: inherit;
    font-family: inherit;
    background: var(--background-select-weak-secondary);
    border-radius: var(--padding);
    padding: var(--padding);
    color: var(--text);
    transition: background var(--transition-duration);
  }
  input.invalid {
    background: var(--background-error-weak-secondary);
  }
  input::placeholder {
    color: var(--text-weak);
  }
  input.invalid::placeholder {
    color: var(--text-error-weak);
  }
  input:focus {
    background: var(--background-select-secondary);
    color: var(--text-strong);
  }
  input.invalid:focus {
    background: var(--background-error-secondary);
  }
</style>
