import Main from 'src/cite/Main.svelte';
import type { IStorage } from 'src/types';

function restoreMain() {
  const app = new Main({
    target: document.body,
    props: { context: 'sidepanel' },
  });
}

document.addEventListener('DOMContentLoaded', restoreMain);
