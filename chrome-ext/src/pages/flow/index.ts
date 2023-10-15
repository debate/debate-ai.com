import Main from '../../flow/components/Main.svelte';

function restoreMain() {
  const app = new Main({
    target: document.body
  });
}

document.addEventListener('DOMContentLoaded', restoreMain);
