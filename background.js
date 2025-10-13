// background.js

// --- КОПИЯ ЛОГИКИ ИЗ "КОРОЧЕ!" ---

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

// --- ЗАГРУЗКА ПРОМПТА ---
async function loadPriceOfferPrompt() {
    let locale = 'en';
    try {
        const currentLocale = chrome.i18n.getUILanguage();
        if (currentLocale.startsWith('ru')) locale = 'ru';
        else if (currentLocale.startsWith('he')) locale = 'he';
    } catch (e) {
        console.warn("Не удалось определить локаль, используем en");
    }

    const url = chrome.runtime.getURL(`instructions/${locale}/price_offer_prompt.txt`);
    try {
        const res = await fetch(url);
        if (res.ok) return await res.text();
    } catch (e) {
        console.warn(`Файл ${url} не найден`);
    }

    // Fallback на английский
    const fallbackUrl = chrome.runtime.getURL(`instructions/en/price_offer_prompt.txt`);
    try {
        const res = await fetch(fallbackUrl);
        if (res.ok) return await res.text();
    } catch (e) {
        console.warn("Английский промпт тоже не найден");
    }

    return "Анализируйте компоненты компьютера и верните структурированный JSON.";
}

// --- ВЫЗОВ GEMINI ---
async function summarizeWithGemini(text, tabId, productId = null) {
    const { geminiApiKey, geminiModel } = await chrome.storage.sync.get(['geminiApiKey', 'geminiModel']);
    const model = geminiModel || 'gemini-2.5-flash';

    if (!geminiApiKey) {
        chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') });
        return;
    }

    const instructions = await loadPriceOfferPrompt();
    const prompt = `Анализируйте компоненты компьютера из следующего текста:\n\n${text.substring(0, 10000)}\n\n${instructions}`;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(geminiApiKey)}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            }
        );

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error.message || "Ошибка Gemini API");
        }

        const summary = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!summary) {
            throw new Error("Пустой ответ от модели");
        }

        // Сохраняем в assembly
        if (productId) {
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

        // Сохраняем результат
        await chrome.storage.local.set({ lastOffer: summary });

        // Показываем результат
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: () => !!window.__gemini_content_script_loaded
        }, (results) => {
            if (results?.[0]?.result) {
                chrome.tabs.sendMessage(tabId, { action: "showSummary", summary });
            } else {
                showSummaryDirectly(tabId, summary);
            }
        });

    } catch (error) {
        console.error("Ошибка Gemini:", error);
        let msg = error.message || "Неизвестная ошибка";
        showErrorOnPage(tabId, `Gemini: ${msg.substring(0, 50)}`);
    }
}

// --- СОЗДАНИЕ МЕНЮ ---
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.removeAll();

    chrome.contextMenus.create({
        id: "generate-offer",
        title: chrome.i18n.getMessage('contextMenuTitle') || 'Сформировать предложение цены',
        contexts: ["page"]
    });

    // Загрузка продуктов
    fetch(chrome.runtime.getURL('data/products.json'))
        .then(r => r.json())
        .then(data => {
            const products = data.ru?.products || [];
            products.forEach(product => {
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
            });
        })
        .catch(e => console.warn('products.json не загружен', e));
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

    // Для всех остальных — запускаем обработку
    showIndicatorOnPage(tab.id, "Формируется предложение...");

    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => document.body.innerText || document.documentElement.innerText
    }, (results) => {
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

        let productId = null;
        if (id.startsWith('product-')) {
            productId = id.replace('product-', '');
        }

        summarizeWithGemini(text, tab.id, productId);
    });
});

// --- ОБРАБОТЧИКИ ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "openChat") {
        chrome.tabs.create({ url: chrome.runtime.getURL("chat.html") });
    }
});