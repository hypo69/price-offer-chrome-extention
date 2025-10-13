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

async function processOfferWithGemini(componentsData, tabId) {
    const { geminiApiKey, geminiModel } = await chrome.storage.sync.get(['geminiApiKey', 'geminiModel']);
    if (!geminiApiKey) {
        await logger.warn('API ключ не установлен, открытие настроек');
        chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') });
        return;
    }
    const textForPrompt = componentsData.map(c => JSON.stringify(c.data, null, 2)).join('\n\n---\n\n');
    await logger.info('Начало обработки предложения из компонентов', { model: geminiModel, componentsCount: componentsData.length });
    try {
        const result = await GeminiAPI.getFullPriceOffer(textForPrompt, geminiApiKey, geminiModel);
        await chrome.storage.local.set({ lastOffer: result });
        await logger.info('Результат успешно получен и сохранен как lastOffer');
        await showResultToUser(tabId, JSON.stringify(JSON.parse(result), null, 2));
        await saveOffer(tabId, result);
    } catch (ex) {
        await logger.error('Ошибка при работе с Gemini API', {
            message: ex.message,
            details: ex.details || 'Дополнительные детали отсутствуют.',
            stack: ex.stack,
        });
        const errorMsg = `Gemini: ${ex.message.substring(0, 100)}`;
        UIManager.showError(tabId, errorMsg);
    }
}

function isTabAccessible(tab) {
    if (!tab?.url) return false;
    const restrictedProtocols = ['chrome://', 'edge://', 'about:', 'file://'];
    return !restrictedProtocols.some(protocol => tab.url.startsWith(protocol));
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

    if (menuItemId === MENU_CONFIG.ADD_COMPONENT_ID) {
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
                // --- ИСПРАВЛЕНИЕ ЗДЕСЬ ---
                func: (locators) => {
                    // Функция для извлечения одного элемента
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
                    // Функция для извлечения всех локаторов
                    function executeLocators(locators) {
                        const result = {};
                        for (const key in locators) {
                            result[key] = getElementValue(locators[key]);
                        }
                        return result;
                    }
                    // ВЫЗОВ И ВОЗВРАТ РЕЗУЛЬТАТА ФУНКЦИИ (ЭТА СТРОКА БЫЛА ПРОПУЩЕНА)
                    return executeLocators(locators);
                },
                // --- КОНЕЦ ИСПРАВЛЕНИЯ ---
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
                const newComponent = { id: `component_${Date.now()}`, name: componentName.trim(), data: data };
                const { [MenuManager.STORAGE_KEY]: components = [] } = await chrome.storage.local.get(MenuManager.STORAGE_KEY);
                components.push(newComponent);
                await chrome.storage.local.set({ [MenuManager.STORAGE_KEY]: components });
                await menuManager.refreshMenu();
                UIManager.showError(tab.id, `Компонент "${componentName.trim()}" добавлен!`, 2500);
            });
        } catch (e) {
            UIManager.hideIndicator(tab.id);
            await logger.error('Ошибка загрузки или обработки локаторов', { error: e.message });
            UIManager.showError(tab.id, `Ошибка: ${e.message}`);
        }
        return;
    }

    if (menuItemId.startsWith('delete-component_')) {
        const componentId = menuItemId.replace('delete-', '');
        await logger.info(`Запрос на удаление компонента: ${componentId}`);
        const { [MenuManager.STORAGE_KEY]: components = [] } = await chrome.storage.local.get(MenuManager.STORAGE_KEY);
        const updatedComponents = components.filter(c => c.id !== componentId);
        await chrome.storage.local.set({ [MenuManager.STORAGE_KEY]: updatedComponents });
        await logger.info(`Компонент ${componentId} удален из хранилища.`);
        await menuManager.refreshMenu();
        return;
    }

    if (menuItemId.startsWith('component_')) {
        const { [MenuManager.STORAGE_KEY]: components = [] } = await chrome.storage.local.get(MenuManager.STORAGE_KEY);
        const foundComponent = components.find(c => c.id === menuItemId);
        if (foundComponent) {
            await logger.info(`Копирование JSON компонента: ${foundComponent.name}`);
            const componentJson = JSON.stringify(foundComponent.data, null, 2);
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: (textToCopy) => { navigator.clipboard.writeText(textToCopy); },
                args: [componentJson]
            });
            UIManager.showError(tab.id, `JSON компонента "${foundComponent.name}" скопирован!`, 2500);
        } else {
            await logger.error(`Сохраненный компонент с ID ${menuItemId} не найден`);
            UIManager.showError(tab.id, 'Ошибка: компонент не найден');
        }
        return;
    }

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

    if (menuItemId === MENU_CONFIG.GENERATE_OFFER_FROM_COMPONENTS_ID) {
        UIManager.showIndicator(tab.id, 'Формируется предложение...');
        const { [MenuManager.STORAGE_KEY]: components = [] } = await chrome.storage.local.get(MenuManager.STORAGE_KEY);
        if (components.length === 0) {
            UIManager.hideIndicator(tab.id);
            UIManager.showError(tab.id, "Нет сохраненных компонентов для формирования предложения.");
            await logger.warn("Попытка сформировать предложение без компонентов.");
            return;
        }
        await processOfferWithGemini(components, tab.id);
        UIManager.hideIndicator(tab.id);
        return;
    }
});