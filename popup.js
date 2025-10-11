// popup.js

// Кнопка "Сохранить" — для API-ключа и модели
document.getElementById('save')?.addEventListener('click', async () => {
    const apiKey = document.getElementById('apiKey').value.trim();
    const model = document.getElementById('model')?.value || 'gemini-1.5-flash';

    if (!apiKey) {
        alert("Пожалуйста, введите API-ключ.");
        return;
    }

    await chrome.storage.sync.set({
        geminiApiKey: apiKey,
        geminiModel: model
    });

    window.close();
});

// Кнопка "Анализировать" — для нового расширения
document.getElementById('analyze')?.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.url || !tab.url.startsWith('http')) {
        alert('Невозможно проанализировать эту страницу.');
        return;
    }

    try {
        await chrome.runtime.sendMessage({
            action: "analyzePage",
            tabId: tab.id,
            url: tab.url
        });
        window.close();
    } catch (error) {
        console.error("Ошибка отправки сообщения:", error);
        alert("Не удалось запустить анализ. Откройте консоль расширения.");
    }
});

// Загрузка сохранённых значений
chrome.storage.sync.get(['geminiApiKey', 'geminiModel'], (result) => {
    const apiKeyEl = document.getElementById('apiKey');
    const modelEl = document.getElementById('model');

    if (apiKeyEl && result.geminiApiKey) {
        apiKeyEl.value = result.geminiApiKey;
    }
    if (modelEl && result.geminiModel) {
        modelEl.value = result.geminiModel;
    }
});