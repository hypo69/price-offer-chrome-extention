// popup.js
document.addEventListener("DOMContentLoaded", async () => {
    const { geminiModel, geminiApiKey } = await chrome.storage.sync.get(['geminiModel', 'geminiApiKey']);
    if (geminiModel) {
        document.getElementById('model').value = geminiModel;
    }
    if (geminiApiKey) {
        document.getElementById('apiKey').value = geminiApiKey;
    }
    document.getElementById('openLogs').addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('debug.html') });
    });
});

document.getElementById('save').addEventListener('click', async () => {
    const apiKey = document.getElementById('apiKey').value.trim();
    const model = document.getElementById('model').value;
    if (!apiKey) {
        alert("Пожалуйста, введите API ключ");
        return;
    }
    await chrome.storage.sync.set({ geminiApiKey: apiKey, geminiModel: model });
    const saveButton = document.getElementById('save');
    saveButton.textContent = 'Сохранено!';
    setTimeout(() => {
        saveButton.textContent = 'Сохранить';
        window.close();
    }, 1000);
});

document.getElementById('extractBtn').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = new URL(tab.url);
    const hostname = url.hostname.replace(/^www\./, "");
    const locatorPath = `locators/${hostname}.json`;

    try {
        const response = await fetch(chrome.runtime.getURL(locatorPath));
        if (!response.ok) throw new Error(`Cannot load locators for ${hostname}`);
        const locators = await response.json();

        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['execute-locators.js'], // ИСПРАВЛЕННОЕ ИМЯ ФАЙЛА
            func: (locators) => {
                return executeLocators(locators);
            },
            args: [locators]
        }, (results) => {
            if (chrome.runtime.lastError || !results || !results[0]?.result) {
                document.getElementById('output').textContent = `Error: ${chrome.runtime.lastError?.message || 'No elements found'}`;
                return;
            }
            const data = results[0].result;
            document.getElementById('output').textContent = JSON.stringify(data, null, 2);
        });

    } catch (e) {
        console.error(e);
        document.getElementById('output').textContent = `Error loading locators: ${e.message}`;
    }
});