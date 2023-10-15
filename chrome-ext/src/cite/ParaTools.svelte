<script lang="ts">
  import Icon from './Icon.svelte';
  import Button from './Button.svelte';
  import ButtonGroup from './ButtonGroup.svelte';
  import { getContext } from 'svelte';
  import type { Readable, Writable } from 'svelte/store';
  import type { IPara } from './types';
  import type { EditHistory } from './history';
  import { createTransition } from './transition';
  import { messenger, popups } from './stores';
  import {
    auth,
    logout,
    autoCut as arguflowAutoCut,
    htmlToParas,
    getUserId,
    URL_USER,
  } from './arguflow';

  let currentTool: Writable<null | 'highlight' | 'underline' | 'eraser'> =
    getContext('currentTool');
  const history: EditHistory = getContext('history');

  export let floating: boolean;
  export let shrunk: boolean;
  function autoCut() {
    let text = '';
    for (let para of paras) {
      for (let run of para) {
        text += run.text;
      }
    }
    if (text.length == 0) {
      messenger.addErrorMessage('No text');
      return;
    }
    if (text.length >= 4300) {
      messenger.addErrorMessage(
        `Too much text, ${text.length}/4300 characters`
      );
      return;
    }
    if (text.length <= 200) {
      messenger.addErrorMessage(
        `Too little text ${text.length}/200 characters`
      );
      return;
    }
    messenger.addMessage('Auto cutting...');

    arguflowAutoCut(text)
      .then((cardHtml) => {
        messenger.addMessage('Done!');
        history.action('autoCutParas', htmlToParas(cardHtml.completion));
      })
      .catch((err) => {
        messenger.addError('auto cut', err);
      });
  }
  let transition = createTransition(
    (t: number, eased: number) => {
      return `
      transform: scale(${eased});
      transform-origin: 0% 50%;
    `;
    },
    'sineOut',
    {
      durationMultiplier: 2,
    }
  );

  export let paras: IPara[];
  function condenseParas() {
    history.action('condenseParas', {});
  }

  let showVault = false;
</script>

<div class="toolbar levelOne">
  <ButtonGroup {floating}>
    <Button
      tooltip={showVault ? 'Hide vault controls' : 'Show vault controls'}
      on:click={() => (showVault = !showVault)}
      selected={showVault}
    >
      <Icon name="vault" />
    </Button>
  </ButtonGroup>
  {#if showVault}
    <div class="subbar" transition:transition|local>
      <ButtonGroup {floating}>
        <Button
          tooltip={$auth.loggedIn ? 'Log out' : 'Log in'}
          selected={!$auth.loggedIn}
          selectedColor={false}
          on:click={() => {
            if ($auth.loggedIn) {
              logout()
                .then(() => {
                  messenger.addMessage('Logged out');
                })
                .catch((err) => {
                  messenger.addError('logout', err);
                });
            } else {
              $popups.push('login');
              $popups = $popups;
            }
          }}
        >
          <Icon name="login" />
        </Button>
        <Button
          tooltip="Account"
          disabled={!$auth.loggedIn}
          on:click={() => {
            getUserId()
              .then((id) => {
                window.open(URL_USER + id, '_blank');
              })
              .catch((err) => {
                messenger.addError('user info', err);
              });
          }}
        >
          <Icon name="person" />
        </Button>
      </ButtonGroup>
      <ButtonGroup>
        <Button
          tooltip="Upload to arguflow"
          disabled={!$auth.loggedIn}
          on:click={() => {
            $popups.push('upload');
            $popups = $popups;
          }}><Icon name="upload" /></Button
        >
        <Button
          tooltip="Auto cut"
          disabled={!$auth.loggedIn}
          on:click={() => {
            autoCut();
          }}><Icon name="robot" /></Button
        >
      </ButtonGroup>
    </div>
  {:else}
    <div class="subbar" transition:transition|local>
      <ButtonGroup {floating}>
      
        <Button
          on:click={() => ($currentTool = 'underline')}
          selected={$currentTool == 'underline'}
          tooltip="Underline"
        >
          <Icon name="underline" />
        </Button>
        
        <Button
          on:click={() => ($currentTool = 'highlight')}
          selected={$currentTool == 'highlight'}
          tooltip="Highlight"
        >
          <Icon name="highlight" />
        </Button>
        <Button
          on:click={() => ($currentTool = 'eraser')}
          selected={$currentTool == 'eraser'}
          tooltip="Eraser"
        >
          <Icon name="eraser" />
        </Button>
      </ButtonGroup>
      <ButtonGroup {floating}>
        <!-- <Button
          on:click={condenseParas}
          disabled={paras.length <= 1}
          tooltip={paras.length <= 1 ? 'Paragraphs merged' : 'Merge paragraphs'}
        >
          <Icon name="merge" />
        </Button> -->
        <Button
          on:click={() => (shrunk = !shrunk)}
          selected={shrunk}
          tooltip={shrunk ? 'Expand text' : 'Shrink text'}
        >
          <Icon name="shrink" />
        </Button>
      </ButtonGroup>
    </div>
  {/if}
</div>

<style>
  .toolbar {
    display: flex;
    flex-direction: row;
    position: sticky;
    top: 0;
    gap: var(--padding);
  }
  .subbar {
    position: absolute;
    display: flex;
    left: calc(var(--padding) * 3 + 1.2rem);
    flex-direction: row;
    gap: var(--padding);
  }
</style>
