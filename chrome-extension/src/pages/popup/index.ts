import Main from '../../../cite/Main.svelte';

function restoreMain() {
  const app = new Main({
    target: document.body,
    props: { context: 'popup' },
  });
}

document.addEventListener('DOMContentLoaded', restoreMain);
