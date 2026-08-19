document.getElementById("check").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url) return;

  const { appOrigin } = await chrome.storage.sync.get({ appOrigin: DEFAULT_APP_ORIGIN });
  const deepLink = buildReuseCheckDeepLink(appOrigin, tab.url);
  chrome.tabs.create({ url: deepLink });
  window.close();
});
