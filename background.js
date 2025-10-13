// background.js

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---

function showIndicatorOnPage(tabId, message) {
    chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: (msg) => {
            let el = document.getElementById('__gemini_indicator__');
            if (el) el.remove();
            el = document.createElement('div');
            el.id = '__gemini_indicator__';
            el.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: rgba(0,0,0,0.88);
                color: white;
                padding: 12px 16px;
                border-radius: 8px;
                font-family: system-ui, sans-serif;
                font-size: 14px;
                z-index: 2147483647;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                max-width: 320px;
                text-align: center;
                pointer-events: none;
            `;
            el.textContent = msg;
            document.body.appendChild(el);
        },
        args: [message]
    });
}

function hideIndicatorOnPage(tabId) {
    chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => {
            const el = document.getElementById('__gemini_indicator__');
            if (el) el.remove();
        }
    });
}

function showErrorOnPage(tabId, message) {
    showIndicatorOnPage(tabId, message);
    setTimeout(() => hideIndicatorOnPage(tabId), 4000);
}

function showSummaryDirectly(tabId, summary) {
    chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: (text) => {
            const old = document.getElementById('__gemini_modal_fallback__');
            if (old) old.remove();

            const overlay = document.createElement('div');
            overlay.id = '__gemini_modal_fallback__';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0,0,0,0.6);
                z-index: 2147483646;
                display: flex;
                justify-content: center;
                align-items: center;
                padding: 20px;
            `;
            const modal = document.createElement('div');
            modal.style.cssText = `
                background: white;
                border-radius: 12px;
                width: 100%;
                max-width: 600px;
                max-height: 80vh;
                padding: 20px;
                font-family: system-ui, sans-serif;
                overflow: auto;
            `;
            modal.textContent = text;
            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            const close = () => {
                if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            };
            overlay.onclick = close;
            document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
        },
        args: [summary]
    });
}

// --- ЗАГРУЗКА ПРОМПТА ПО ЛОКАЛИ ---
async function loadPriceOfferPrompt() {
    let locale = 'en';
    try {
        const currentLocale = chrome.i18n.getUILanguage();
        if (currentLocale.startsWith('ru')) locale = 'ru';
        else if (currentLocale.startsWith('he')) locale = 'he';
    } catch (e) {
        console.warn("Не удалось определить локаль, используем en");
    }

    const tryLoad = async (path) => {
        try {
            const url = chrome.runtime.getURL(path);
            const res = await fetch(url);
            if (res.ok) return await res.text();
        } catch (e) {
            console.warn(`Не удалось загрузить ${path}`);
        }
        return null;
    };

    let promptText = await tryLoad(`instructions/${locale}/price_offer_prompt.txt`);
    if (!promptText) {
        promptText = await tryLoad(`instructions/en/price_offer_prompt.txt`);
    }
    return promptText || "Анализируйте компоненты компьютера и верните структурированный JSON.";
}

// --- ВЫЗОВ GEMINI API ---
async function callGeminiAPI(pageText, apiKey, model) {
    const instructions = await loadPriceOfferPrompt();
    const prompt = `Анализируйте компоненты компьютера из следующего текста:\n\n${pageText.substring(0, 10000)}\n\n${instructions}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
        })
    });

    const data = await response.json();
    if (data.error) {
        throw new Error(data.error.message || "Ошибка Gemini API");
    }

    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!resultText) {
        throw new Error("Пустой ответ от модели");
    }

    return resultText;
}

// --- СОХРАНЕНИЕ В ASSEMBLY ---
async function addToAssembly(productId) {
    if (!productId) return;

    const stored = await chrome.storage.local.get("assembly");
    let assembly = stored.assembly || { products: [] };

    try {
        const resp = await fetch(chrome.runtime.getURL('data/products.json'));
        const productsData = await resp.json();
        const product = productsData.ru?.products.find(p => p.product_id === productId);
        if (product && !assembly.products.some(p => p.product_id === productId)) {
            assembly.products.push(product);
            await chrome.storage.local.set({ assembly });
        }
    } catch (e) {
        console.warn("Не удалось обновить assembly", e);
    }
}

// --- СОЗДАНИЕ МЕНЮ ---
chrome.runtime.onInstalled.addListener(async () => {
    chrome.contextMenus.removeAll();

    const title = chrome.i18n.getMessage('contextMenuTitle') || 'Сформировать предложение цены';

    chrome.contextMenus.create({
        id: "generate-offer",
        title,
        contexts: ["page"]
    });

    let products = [];
    try {
        const resp = await fetch(chrome.runtime.getURL('data/products.json'));
        const data = await resp.json();
        products = data.ru?.products || [];
    } catch (e) {
        console.warn('products.json is missing or invalid', e);
    }

    for (const product of products) {
        chrome.contextMenus.create({
            id: `product-${product.product_id}`,
            parentId: "generate-offer",
            title: product.product_name,
            contexts: ["page"]
        });

        chrome.contextMenus.create({
            id: `delete-${product.product_id}`,
            parentId: `product-${product.product_id}`,
            title: '❌ Удалить',
            contexts: ["page"]
        });
    }
});

// --- ОБРАБОТКА КЛИКОВ ---
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (!tab?.url ||
        tab.url.startsWith('chrome://') ||
        tab.url.startsWith('edge://') ||
        tab.url.startsWith('about:') ||
        tab.url.startsWith('file://')) {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: 'Price Offer Generator',
            message: 'Действие недоступно на внутренних или локальных страницах.'
        });
        return;
    }

    const id = info.menuItemId;

    if (id.startsWith('delete-')) {
        const productId = id.replace('delete-', '');
        chrome.storage.local.get("assembly", (stored) => {
            let assembly = stored.assembly || { products: [] };
            assembly.products = assembly.products.filter(p => p.product_id !== productId);
            chrome.storage.local.set({ assembly }, () => {
                console.log(`Product ${productId} removed from assembly`);
            });
        });
        return;
    }

    // Показываем индикатор
    showIndicatorOnPage(tab.id, "Формируется предложение...");

    // Получаем текст страницы
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => document.body.innerText || document.documentElement.innerText
    }, async (results) => {
        hideIndicatorOnPage(tab.id);

        if (chrome.runtime.lastError) {
            showErrorOnPage(tab.id, "Не удалось получить текст");
            return;
        }

        const text = results?.[0]?.result;
        if (!text || text.trim().length < 10) {
            showErrorOnPage(tab.id, "Страница содержит мало контента");
            return;
        }

        // Получаем настройки
        const { geminiApiKey, geminiModel } = await chrome.storage.sync.get(['geminiApiKey', 'geminiModel']);
        const model = geminiModel || 'gemini-2.5-flash';

        if (!geminiApiKey) {
            chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') });
            return;
        }

        let productId = null;
        if (id.startsWith('product-')) {
            productId = id.replace('product-', '');
        }

        try {
            const resultText = await callGeminiAPI(text, geminiApiKey, model);

            // Сохраняем в assembly
            await addToAssembly(productId);

            // Сохраняем результат
            await chrome.storage.local.set({ lastOffer: resultText });

            // Показываем результат
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => !!window.__gemini_content_script_loaded
            }, (results) => {
                if (results?.[0]?.result) {
                    chrome.tabs.sendMessage(tab.id, { action: "showSummary", summary: resultText });
                } else {
                    showSummaryDirectly(tab.id, resultText);
                }
            });

        } catch (error) {
            console.error("Ошибка Gemini:", error);
            showErrorOnPage(tab.id, `Gemini: ${error.message.substring(0, 50)}`);
        }
    });
});

// --- ОБРАБОТЧИКИ СООБЩЕНИЙ ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "openChat") {
        chrome.tabs.create({ url: chrome.runtime.getURL("chat.html") });
    } else if (request.action === "openResult") {
        chrome.tabs.create({ url: chrome.runtime.getURL("result.html") });
    }
});

// Открытие popup по клику на иконку
chrome.action.onClicked.addListener((tab) => {
    chrome.tabs.create({ url: chrome.runtime.getURL("popup.html") });
});