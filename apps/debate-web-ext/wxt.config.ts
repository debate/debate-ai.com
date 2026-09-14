import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  // `wxt dev` launches a browser via chrome-launcher, which only auto-detects
  // "Google Chrome" / "Chromium". This machine only has Chrome Beta installed,
  // so point the dev runner at it explicitly.
  runner: {
    binaries: {
      chrome:
        '/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta',
    },
  },
  manifest: {
    name: 'Debate AI — Timer & Card Reuse Check',
    description:
      'Critical times call for critical thinking! A debate round timer with prep clocks and a round timeline, plus an on-page card reuse check against your team\'s shared evidence library.',
    // Kept from the original timer manifest so the extension ID (and therefore
    // the user's existing chrome.storage data) stays stable across both the
    // WXT migration and the merge with the card-reuse extension.
    key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAjrcSiPHdMYVhqXi8/Dhktfs6019hLifp6cQm9hs3VToy+5tb3QcHwpX1H+Pc/Jf9G12oO6a3N2FE7Yz3RGI/eOpLhnmftWLpGK6k09cULjSWYjWi1RhijhZ4BkmNkU1A2wgECHs0fnnTBnZovMffFcLnkmtuatCetfGXmhwZzbqfAQwGrLtdtt2g09s7VCPv9YCJlzswx74CoLmAjGSRdHf/ZIX8QqsUQR4ATor/KcKn60sNLV/Ef395OtdN3VkD0IkB6pbtqpG7UxMYmGixapYeKRQMPS4IUlrc5RchoYKA1VUGQkMwsTI10159vBre70+MKrE9EJ2lYguHgKrYEwIDAQAB',
    // `storage` for the timer's session/timeline and the shared settings;
    // `activeTab` for the popup's reuse check reading the current page's URL;
    // `contextMenus` for the right-click "Check this page for existing cards".
    permissions: ['storage', 'activeTab', 'contextMenus'],
    // The deployments the reuse check may call (see the Options page).
    host_permissions: ['https://debate-ai.com/*', 'http://localhost:3000/*'],
    // `action.default_popup` (and its title, from the popup's <title>) come
    // from entrypoints/popup; the background worker swaps the popup out when
    // the toolbar icon is configured to open the timer window instead.
    icons: {
      16: '/icon/16.png',
      32: '/icon/32.png',
      48: '/icon/48.png',
      96: '/icon/96.png',
      128: '/icon/128.png',
    },
  },
});
