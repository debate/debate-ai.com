(function () {
  'use strict';

  (async () => {
    await import(
      /* @vite-ignore */
      chrome.runtime.getURL("assets/index.ts-1e768ade.js")
    );
  })().catch(console.error);

})();
