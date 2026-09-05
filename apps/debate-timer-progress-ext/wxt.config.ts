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
    name: 'Debate Timer',
    description:
      'Critical times call for critical thinking! A debate round timer with prep clocks and a round timeline.',
    // Kept from the original manifest so the extension ID (and therefore the
    // user's existing chrome.storage data) stays stable across the migration.
    key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAjrcSiPHdMYVhqXi8/Dhktfs6019hLifp6cQm9hs3VToy+5tb3QcHwpX1H+Pc/Jf9G12oO6a3N2FE7Yz3RGI/eOpLhnmftWLpGK6k09cULjSWYjWi1RhijhZ4BkmNkU1A2wgECHs0fnnTBnZovMffFcLnkmtuatCetfGXmhwZzbqfAQwGrLtdtt2g09s7VCPv9YCJlzswx74CoLmAjGSRdHf/ZIX8QqsUQR4ATor/KcKn60sNLV/Ef395OtdN3VkD0IkB6pbtqpG7UxMYmGixapYeKRQMPS4IUlrc5RchoYKA1VUGQkMwsTI10159vBre70+MKrE9EJ2lYguHgKrYEwIDAQAB',
    permissions: ['storage'],
    action: {
      default_title: 'Debate Timer',
    },
    icons: {
      16: '/icon/16.png',
      32: '/icon/32.png',
      48: '/icon/48.png',
      96: '/icon/96.png',
      128: '/icon/128.png',
    },
  },
});
