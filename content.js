// content.js — полный исправленный код

window.__gemini_content_script_loaded = true;

let __geminiIndicator = null;

function showIndicator(text) {
    hideIndicator();
    __geminiIndicator = document.createElement("div");
    __geminiIndicator.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #333;
        color: white;
        padding: 12px 24px;
        border-radius: 6px;
        z-index: 2147483647;
        font-family: system-ui, sans-serif;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        font-size: 16px;
        max-width: 90%;
        text-align: center;
        word-wrap: break-word;
    `;
    __geminiIndicator.textContent = text;
    document.body.appendChild(__geminiIndicator);
}

function hideIndicator() {
    if (__geminiIndicator?.parentNode) {
        __geminiIndicator.parentNode.removeChild(__geminiIndicator);
        __geminiIndicator = null;
    }
}

async function getApiKeyAndModel() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['geminiApiKey', 'geminiModel'], (settings) => {
            const apiKey = settings.geminiApiKey;
            const model = settings.geminiModel || 'gemini-2.5-flash';
            resolve({ apiKey, model });
        });
    });
}

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.action === "generateOffer" || request.action === "generateOfferAll") {
        const { apiKey, model } = await getApiKeyAndModel();

        if (!apiKey) {
            chrome.tabs.create({ url: chrome.runtime.getURL("popup.html") });
            return;
        }

        showIndicator("Формируется предложение...");

        const pageText = document.body.innerText.trim();
        if (!pageText) {
            hideIndicator();
            alert("Страница пуста или содержит мало контента");
            return;
        }

        chrome.runtime.sendMessage({
            action: "callGemini",
            prompt: `Анализируйте компоненты компьютера из следующего текста:\n\n${pageText}\n\nИспользуйте инструкции из price_offer_prompt.txt.`,
            model,
            apiKey
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error("Ошибка связи с background:", chrome.runtime.lastError.message);
                hideIndicator();
                alert("Ошибка связи с фоновым скриптом");
                return;
            }

            if (response.error) {
                hideIndicator();
                alert(`Ошибка Gemini: ${response.error}`);
                return;
            }

            chrome.storage.local.set({ lastOffer: response }, () => {
                hideIndicator();
                chrome.tabs.create({ url: chrome.runtime.getURL("result.html") });
            });
        });
    }
});

console.log("🟢 Content script loaded");