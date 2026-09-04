/**
 * Options page script — lets a contributor point the extension at a
 * different debate-ai.com deployment (e.g. a staging environment) instead
 * of the production default.
 */

async function load() {
  document.getElementById("api-base").value = await getApiBase();
  document.getElementById("skip-domains").value = await getSkipDomainsRaw();
}

document.getElementById("save").addEventListener("click", async () => {
  const value = document.getElementById("api-base").value;
  await setApiBase(value);
  await setSkipDomains(document.getElementById("skip-domains").value);
  const saved = document.getElementById("saved");
  saved.style.display = "block";
  setTimeout(() => {
    saved.style.display = "none";
  }, 1500);
});

load();
