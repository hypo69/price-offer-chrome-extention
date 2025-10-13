// background.js

/**
 * Модуль фоновой службы расширения
 * =================================
 * Оркестрация событий и управление основной логикой.
 */

// Импорт зависимостей
importScripts('logger.js', 'ui-manager.js', 'gemini.js', 'menu.js');

// Инициализация сервисов
const logger = new Logger('__kazarinov_logs__', 100);
const menuManager = new MenuManager(logger);

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ И ЛОГИКА ПРИЛОЖЕНИЯ ---

/**
 * Обновление сборки компьютера в storage
 */
async function updateAssembly(productId) {
    if (!productId) return false;
    try {
        const stored = await chrome.storage.local.get('assembly');
        let assembly = stored.assembly || { products: [] };
        const resp = await fetch(chrome.runtime.getURL('data/products.json'));
        if (!resp.ok) {
            await logger.error('Не удалось загрузить products.json', { status: resp.status });
            return false;
        }
        const productsData = await resp.json();
        const product = productsData.ru?.products.find(p => p.product_id === productId);
        if (!product) {
            await logger.warn(`Продукт ${productId} не найден в базе`);
            return false;
        }
        if (!assembly.products.some(p => p.product_id === productId)) {
            assembly.products.push(product);
            await chrome.storage.local.set({ assembly });
            await logger.info(`Продукт ${productId} добавлен в сборку`);
            return true;
        }
        await logger.debug(`Продукт ${productId} уже в сборке`);
        return true;
    } catch (ex) {
        await logger.error('Ошибка обновления сборки', { error: ex.message, productId });
        return false;
    }
}

/**
 * Отображение результата пользователю
 */
async function showResultToUser(tabId, summary) {
    chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => !!window.__gemini_content_script_loaded
    }, (results) => {
        if (results?.[0]?.result) {
            chrome.tabs.sendMessage(tabId, { action: 'showSummary', summary });
        } else {
            UIManager.showModal(tabId, summary);
        }
    });
}

/**
 * Сохранение предложения (логика и UI)
 */
async function saveOffer(tabId, result) {
    const injectionResult = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => prompt("Введите название для этого предложения:", `Предложение от ${new Date().toLocaleString()}`)
    });

    const offerName = injectionResult[0]?.result;
    if (!offerName || offerName.trim() === '') {
        await logger.info('Сохранение отменено пользователем.');
        return;
    }

    const offerId = `offer_${Date.now()}`;
    const newOffer = { name: offerName, data: result };

    const { savedOffers = {} } = await chrome.storage.local.get('savedOffers');
    savedOffers[offerId] = newOffer;
    await chrome.storage.local.set({ savedOffers });

    await menuManager.addSavedOfferItem(offerId, offerName);
}

/**
 * Обработка анализа текста через Gemini API
 */
async function processWithGemini(text, tabId, productId = null) {
    const { geminiApiKey, geminiModel } = await chrome.storage.sync.get(['geminiApiKey', 'geminiModel']);
    if (!geminiApiKey) {
        await logger.warn('API ключ не установлен, открытие настроек');
        chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') });
        return;
    }
    await logger.info('Начало обработки через Gemini', { model: geminiModel, textLength: text.length });
    try {
        const result = await GeminiAPI.getFullPriceOffer(text, geminiApiKey, geminiModel);
        if (productId) {
            await updateAssembly(productId);
        }
        await chrome.storage.local.set({ lastOffer: result });
        await logger.info('Результат успешно получен и сохранен как lastOffer');
        await showResultToUser(tabId, JSON.stringify(JSON.parse(result), null, 2));
        await saveOffer(tabId, result);
    } catch (ex) {
        await logger.error('Ошибка при работе с Gemini API', {
            message: ex.message,
            details: ex.details || 'Дополнительные детали отсутствуют.',
            stack: ex.stack,
            productId
        });
        const errorMsg = `Gemini: ${ex.message.substring(0, 100)}`;
        UIManager.showError(tabId, errorMsg);
    }
}

/**
 * Извлечение текста со страницы
 */
async function extractPageText(tabId) {
    return new Promise((resolve) => {
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: () => document.body.innerText || document.documentElement.innerText
        }, (results) => {
            if (chrome.runtime.lastError) {
                logger.error('Ошибка извлечения текста', { error: chrome.runtime.lastError.message });
                resolve(null); return;
            }
            const text = results?.[0]?.result;
            if (!text || text.trim().length < 10) {
                resolve(null); return;
            }
            resolve(text);
        });
    });
}

/**
 * Проверка доступности вкладки для работы расширения
 */
function isTabAccessible(tab) {
    if (!tab?.url) return false;
    const restrictedProtocols = ['chrome://', 'edge://', 'about:', 'file://'];
    return !restrictedProtocols.some(protocol => tab.url.startsWith(protocol));
}

/**
 * Удаление продукта из сборки
 */
async function removeFromAssembly(productId) {
    chrome.storage.local.get('assembly', async (stored) => {
        let assembly = stored.assembly || { products: [] };
        assembly.products = assembly.products.filter(p => p.product_id !== productId);
        await chrome.storage.local.set({ assembly });
        await logger.info(`Продукт ${productId} удален из сборки`);
    });
}


// --- ОБРАБОТЧИКИ СОБЫТИЙ РАСШИРЕНИЯ ---

chrome.runtime.onInstalled.addListener(async () => {
    await logger.info('Расширение установлено/обновлено');
    await menuManager.initialize();
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (!isTabAccessible(tab)) {
        UIManager.showNotification('Price Offer Generator', 'Действие недоступно на этой странице.');
        await logger.warn('Попытка использования на недоступной странице', { url: tab.url });
        return;
    }

    const menuItemId = info.menuItemId;
    const MENU_CONFIG = MenuManager.CONFIG;

    // Нажали на кнопку "Извлечь и добавить текущий компонент"
    if (menuItemId === MENU_CONFIG.EXTRACT_AND_ADD_COMPONENT_ID) {
        UIManager.showIndicator(tab.id, 'Извлечение данных...');
        await logger.info('Начало извлечения данных по локаторам', { tabId: tab.id });

        const url = new URL(tab.url);
        const hostname = url.hostname.replace(/^www\./, "");
        const locatorPath = `locators/${hostname}.json`;

        try {
            const response = await fetch(chrome.runtime.getURL(locatorPath));
            if (!response.ok) throw new Error(`Не удалось загрузить локаторы для ${hostname}`);
            const locators = await response.json();

            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: (locators) => {
                    function getElementValue(locator) {
                        const { by, selector, attribute, if_list, mandatory, locator_description } = locator;
                        let elements = [];
                        try {
                            if (by === "XPATH") {
                                const iterator = document.evaluate(selector, document, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
                                let node = iterator.iterateNext();
                                while (node) { elements.push(node); node = iterator.iterateNext(); }
                            } else if (by === "ID") {
                                const el = document.getElementById(selector);
                                if (el) elements.push(el);
                            } else if (by === "CLASS") {
                                elements = Array.from(document.getElementsByClassName(selector));
                            } else if (by === "CSS_SELECTOR") {
                                elements = Array.from(document.querySelectorAll(selector));
                            }
                            if (!elements.length) {
                                if (mandatory) console.error(`Mandatory locator not found: ${locator_description}`);
                                return if_list === "all" ? [] : null;
                            }
                            if (if_list === "all") {
                                return elements.map(el => el[attribute] ?? el.getAttribute(attribute));
                            } else {
                                return elements[0][attribute] ?? elements[0].getAttribute(attribute);
                            }
                        } catch (e) {
                            console.error(`Error extracting locator ${locator_description}:`, e);
                            return if_list === "all" ? [] : null;
                        }
                    }
                    function executeLocators(locators) {
                        const result = {};
                        for (const key in locators) {
                            result[key] = getElementValue(locators[key]);
                        }
                        return result;
                    }
                    return executeLocators(locators);
                },
                args: [locators]
            }, async (results) => {
                UIManager.hideIndicator(tab.id);
                if (chrome.runtime.lastError || !results || !results[0]?.result) {
                    const errorMsg = chrome.runtime.lastError ? chrome.runtime.lastError.message : 'Данные не найдены';
                    await logger.error('Ошибка извлечения компонента', { error: errorMsg });
                    UIManager.showError(tab.id, 'Не удалось извлечь данные');
                    return;
                }

                const data = results[0].result;
                const componentName = data.name;

                if (!componentName || typeof componentName !== 'string' || componentName.trim() === '') {
                    await logger.warn('Имя компонента не найдено после извлечения.', { data });
                    UIManager.showError(tab.id, 'Не удалось определить имя компонента');
                    return;
                }

                const newComponent = {
                    id: `component_${Date.now()}`,
                    name: componentName.trim(),
                    data: data
                };

                const { [MenuManager.STORAGE_KEY]: components = [] } = await chrome.storage.local.get(MenuManager.STORAGE_KEY);
                components.push(newComponent);
                await chrome.storage.local.set({ [MenuManager.STORAGE_KEY]: components });

                await menuManager.addExtractedComponentItem(newComponent);

                await showResultToUser(tab.id, JSON.stringify(data, null, 2));
            });

        } catch (e) {
            UIManager.hideIndicator(tab.id);
            await logger.error('Ошибка загрузки или обработки локаторов', { error: e.message });
            UIManager.showError(tab.id, `Ошибка: ${e.message}`);
        }
        return;
    }

    // Нажали на один из уже добавленных компонентов в подменю
    if (menuItemId.startsWith('component_')) {
        const { [MenuManager.STORAGE_KEY]: components = [] } = await chrome.storage.local.get(MenuManager.STORAGE_KEY);
        const foundComponent = components.find(c => c.id === menuItemId);

        if (foundComponent) {
            await logger.info(`Показ сохраненного компонента: ${foundComponent.name}`);
            await showResultToUser(tab.id, JSON.stringify(foundComponent.data, null, 2));
        } else {
            await logger.error(`Сохраненный компонент с ID ${menuItemId} не найден`);
            UIManager.showError(tab.id, 'Ошибка: компонент не найден');
        }
        return;
    }

    // Нажали на сохраненное ПРЕДЛОЖЕНИЕ
    if (menuItemId.startsWith('offer_')) {
        const { savedOffers = {} } = await chrome.storage.local.get('savedOffers');
        const savedOffer = savedOffers[menuItemId];
        if (savedOffer) {
            await logger.info(`Загрузка сохраненного предложения: ${savedOffer.name}`);
            await showResultToUser(tab.id, JSON.stringify(JSON.parse(savedOffer.data), null, 2));
        } else {
            await logger.error(`Сохраненное предложение с ID ${menuItemId} не найдено`);
            UIManager.showError(tab.id, 'Ошибка: предложение не найдено');
        }
        return;
    }

    // Нажали "удалить" продукт
    if (menuItemId.startsWith('delete-')) {
        const productId = menuItemId.replace('delete-', '');
        await removeFromAssembly(productId);
        await menuManager.initialize();
        return;
    }

    // Нажали "Сформировать предложение" или один из продуктов
    if (menuItemId === MENU_CONFIG.CONTEXT_MENU_ID || menuItemId.startsWith('product-')) {
        UIManager.showIndicator(tab.id, 'Формируется предложение...');
        await logger.info('Начало обработки предложения', { menuItemId });
        const text = await extractPageText(tab.id);
        UIManager.hideIndicator(tab.id);
        if (!text) {
            UIManager.showError(tab.id, 'Не удалось получить текст страницы');
            await logger.error('Страница содержит мало контента');
            return;
        }
        let productId = null;
        if (menuItemId.startsWith('product-')) {
            productId = menuItemId.replace('product-', '');
        }
        await processWithGemini(text, tab.id, productId);
    }
});

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.action === 'openChat') {
        chrome.tabs.create({ url: chrome.runtime.getURL('chat.html') });
        await logger.info('Открыта страница чата');
    }
});