// background.js

/**
 * Модуль фоновой службы расширения
 * =================================
 * Оркестрация событий и управление основной логикой расширения
 */

importScripts('logger.js', 'ui-manager.js', 'gemini.js', 'menu.js', 'handlers.js');

const logger = new Logger('__kazarinov_logs__', 100);
const menuManager = new MenuManager(logger);

/**
 * Отображение результата пользователю
 */
async function showResultToUser(tabId, summary) {
    await logger.debug('Попытка отображения результата пользователю', { tabId: tabId });

    chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => !!window.__gemini_content_script_loaded
    }, async (results) => {
        if (chrome.runtime.lastError) {
            await logger.error('Ошибка проверки content script', {
                error: chrome.runtime.lastError.message,
                tabId: tabId
            });
            UIManager.showModal(tabId, summary);
            return;
        }

        if (results?.[0]?.result) {
            await logger.debug('Content script обнаружен, отправка через sendMessage');
            chrome.tabs.sendMessage(tabId, { action: 'showSummary', summary: summary });
        } else {
            await logger.debug('Content script не найден, использование fallback модального окна');
            UIManager.showModal(tabId, summary);
        }
    });
}

/**
 * Сохранение предложения с пользовательским названием
 */
async function saveOffer(tabId, result) {
    try {
        const injectionResult = await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: () => prompt(
                'Введите название для этого предложения:',
                `Предложение от ${new Date().toLocaleString()}`
            )
        });

        const offerName = injectionResult[0]?.result;

        if (!offerName || offerName.trim() === '') {
            await logger.info('Сохранение предложения отменено пользователем');
            return;
        }

        const offerId = `offer_${Date.now()}`;
        const newOffer = { name: offerName, data: result };
        const { savedOffers = {} } = await chrome.storage.local.get('savedOffers');

        savedOffers[offerId] = newOffer;
        await chrome.storage.local.set({ savedOffers: savedOffers });

        await menuManager.addSavedOfferItem(offerId, offerName);

        await logger.info('Предложение успешно сохранено', {
            offerId: offerId,
            offerName: offerName
        });

    } catch (ex) {
        await logger.error('Ошибка сохранения предложения', {
            error: ex.message,
            stack: ex.stack
        });
    }
}

/**
 * Обработка предложения с помощью Gemini API
 */
async function processOfferWithGemini(componentsData, tabId) {
    try {
        const { geminiApiKey, geminiModel } = await chrome.storage.sync.get(['geminiApiKey', 'geminiModel']);

        if (!geminiApiKey) {
            await logger.warn('API ключ не установлен, открытие страницы настроек');
            chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') });
            return;
        }

        const textForPrompt = componentsData
            .map(c => JSON.stringify(c.data, null, 2))
            .join('\n\n---\n\n');

        await logger.info('Начало обработки предложения из компонентов', {
            model: geminiModel,
            componentsCount: componentsData.length,
            promptLength: textForPrompt.length
        });

        const result = await GeminiAPI.getFullPriceOffer(textForPrompt, geminiApiKey, geminiModel);

        await chrome.storage.local.set({ lastOffer: result });

        await logger.info('Результат успешно получен и сохранен как lastOffer');

        const formattedResult = JSON.stringify(JSON.parse(result), null, 2);
        await showResultToUser(tabId, formattedResult);
        await saveOffer(tabId, result);

    } catch (ex) {
        await logger.error('Ошибка при работе с Gemini API', {
            message: ex.message,
            details: ex.details || 'Дополнительные детали отсутствуют',
            stack: ex.stack
        });

        const errorMsg = `Ошибка Gemini: ${ex.message.substring(0, 100)}`;
        UIManager.showError(tabId, errorMsg, 4000, true);
    }
}

/**
 * Проверка доступности вкладки
 */
function isTabAccessible(tab) {
    if (!tab || !tab.url) {
        return false;
    }

    const restrictedProtocols = ['chrome://', 'edge://', 'about:', 'file://'];
    return !restrictedProtocols.some(protocol => tab.url.startsWith(protocol));
}

/**
 * Обработчик установки/обновления расширения
 */
chrome.runtime.onInstalled.addListener(async () => {
    await logger.info('Расширение установлено/обновлено');
    await menuManager.initialize();
});

/**
 * Обработчик кликов по контекстному меню
 */
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (!isTabAccessible(tab)) {
        UIManager.showNotification(
            'Price Offer Generator',
            'Действие недоступно на этой странице.'
        );
        await logger.warn('Попытка использования на недоступной странице', { url: tab.url });
        return;
    }

    const menuItemId = info.menuItemId;
    const MENU_CONFIG = MenuManager.CONFIG;

    await logger.info('Обработка клика по пункту меню', {
        menuItemId: menuItemId,
        tabId: tab.id,
        url: tab.url
    });

    if (menuItemId === MENU_CONFIG.ADD_COMPONENT_ID) {
        await handleAddComponent(tab);
        return;
    }

    if (menuItemId.startsWith('delete-component_')) {
        await handleDeleteComponent(menuItemId);
        return;
    }

    if (menuItemId.startsWith('component_')) {
        await handleCopyComponent(menuItemId, tab);
        return;
    }

    if (menuItemId.startsWith('offer_')) {
        await handleLoadOffer(menuItemId, tab);
        return;
    }

    if (menuItemId === MENU_CONFIG.GENERATE_OFFER_FROM_COMPONENTS_ID) {
        await handleGenerateOffer(tab);
        return;
    }
});

logger.info('Background script инициализирован и готов к работе');
