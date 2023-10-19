import type { IStorage, ICard } from 'src/cite/types';
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  handleResponse(request, sender, sendResponse);
  return true;
});
async function handleResponse(
  request: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
) {
  if (request?.message == 'getCardData') {
    let tabs = await chrome.tabs.query({ active: true });
    // get url of current tab
    chrome.tabs.sendMessage(tabs[0].id, request, function (response) {
      if (response?.message == 'gotCardData') {
        sendResponse({
          message: 'gotCardData',
          card: response.card,
        });
      }
    });
  }
}



// Allows users to open the side panel by clicking on the action toolbar icon
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {

      await chrome.sidePanel.setOptions({
        tabId,
        path: "src/pages/sidepanel/index.html",
        enabled: true
      });

});