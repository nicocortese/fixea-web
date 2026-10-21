document.getElementById("toggle-btn").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.id) {
    chrome.tabs.sendMessage(tab.id, { action: "toggle_pinning" }, (response) => {
      window.close();
    });
  }
});