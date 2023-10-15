import Main from '../../cite/Main.svelte';

function restoreMain() {
  const app = new Main({
    target: document.body
  });
}

document.addEventListener('DOMContentLoaded', restoreMain);
