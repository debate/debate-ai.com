const input = document.getElementById("appOrigin");
const status = document.getElementById("status");

async function load() {
  const { appOrigin } = await chrome.storage.sync.get({ appOrigin: DEFAULT_APP_ORIGIN });
  input.value = appOrigin;
}

document.getElementById("save").addEventListener("click", async () => {
  const appOrigin = input.value.trim() || DEFAULT_APP_ORIGIN;
  await chrome.storage.sync.set({ appOrigin });
  status.textContent = "Saved.";
  setTimeout(() => {
    status.textContent = "";
  }, 1500);
});

load();
