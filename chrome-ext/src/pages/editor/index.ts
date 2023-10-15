import Main from '../../editor/Main.svelte';


function restoreMain() {
  const app = new Main({
    target: document.body
  });
}

document.addEventListener('DOMContentLoaded', restoreMain);
