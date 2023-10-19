<script lang="ts">
  import { onMount } from 'svelte';
  export let text: string;
  export let placeholder: string = '';
  export let autofocus = false;

  // auto resize based on content
  let textarea: HTMLTextAreaElement;
  let textHeight: number;
  let textWidth: number;
  export function autoHeight() {
    if (textarea) {
      textarea.value = textarea.value.replace(/\r?\n|\r/g, '');
      textarea.style.height = '0px';
      textarea.style.height = textarea.scrollHeight + 'px';
    }
  }
  onMount(function () {
    autoHeight();
    if (autofocus) {
      textarea.focus();
    }
  });
</script>

<textarea
  bind:value={text}
  bind:this={textarea}
  style={`${textHeight}px; width: ${textWidth}px;`}
  on:input={autoHeight}
  {placeholder}
/>

<style>
  textarea {
    overflow-y: hidden;

    width: 100%;
    height: 100%;

    background: none;
    border-radius: 0;
    color: inherit;

    font-size: inherit;
    font-weight: inherit;
    font-family: inherit;
  }
  textarea::placeholder {
    color: var(--text-weak);
  }
</style>
