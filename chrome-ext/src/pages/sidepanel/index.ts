import Main from 'src/flow/components/Main.svelte';
import type { IStorage } from 'src/types';

function restoreMain() {
  const app = new Main({
    target: document.body,
    props: { context: 'sidepanel' },
  });
}

document.addEventListener('DOMContentLoaded', restoreMain);
