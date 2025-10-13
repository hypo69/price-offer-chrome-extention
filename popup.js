// popup.js

document.addEventListener("DOMContentLoaded", async () => {
    const { geminiModel } = await chrome.storage.sync.get(['geminiModel']);
    if (geminiModel) {
        document.getElementById('model').value = geminiModel;
    }
});

document.getElementById('save').addEventListener('click', async () => {
    const apiKey = document.getElementById('apiKey').value.trim();
    const model = document.getElementById('model').value;
    if (!apiKey) {
        alert("Пожалуйста, введите API ключ");
        return;
    }
    await chrome.storage.sync.set({ geminiApiKey: apiKey, geminiModel: model });
    window.close();
});