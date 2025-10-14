// background.js
// \file background.js
// -*- coding: utf-8 -*-

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
 * 
 * Args:
 *     tabId (number): ID вкладки
 *     summary (string): Текст результата для отображения
 */
async function showResultToUser(tabId, summary) {
    logger.debug('Попытка отображения результата пользователю', { tabId: tabId });

    chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => !!window.__gemini_content_script_loaded
    }, async (results) => {
        if (chrome.runtime.lastError) {
            logger.error('Ошибка проверки content script', {
                error: chrome.runtime.lastError.message,
                tabId: tabId
            });
            UIManager.showModal(tabId, summary);
            return;
        }

        if (results?.[0]?.result) {
            logger.debug('Content script обнаружен, отправка через sendMessage');
            chrome.tabs.sendMessage(tabId, { action: 'showSummary', summary: summary });
        } else {
            logger.debug('Content script не найден, использование fallback модального окна');
            UIManager.showModal(tabId, summary);
        }
    });
}

/**
 * Сохранение предложения с пользовательским названием
 * 
 * Args:
 *     tabId (number): ID вкладки
 *     result (string): Данные результата для сохранения
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
            logger.info('Сохранение предложения отменено пользователем');
            return;
        }

        const offerId = `offer_${Date.now()}`;
        const newOffer = { name: offerName, data: result };
        const { savedOffers = {} } = await chrome.storage.local.get('savedOffers');

        savedOffers[offerId] = newOffer;
        await chrome.storage.local.set({ savedOffers: savedOffers });

        await menuManager.addSavedOfferItem(offerId, offerName);

        logger.info('Предложение успешно сохранено', {
            offerId: offerId,
            offerName: offerName
        });

    } catch (ex) {
        logger.error('Ошибка сохранения предложения', {
            error: ex.message,
            stack: ex.stack
        });
    }
}


/**
 * Обработка предложения с помощью Gemini API
 * 
 * Args:
 *     componentsData (Array): Массив данных компонентов
 *     tabId (number): ID вкладки
 */
async function processOfferWithGemini(componentsData, tabId) {
    try {
        // Получаем ключ и модель из синхронизированного хранилища
        const { geminiApiKey, geminiModel = 'gemini-2.5-flash' } = await chrome.storage.sync.get(['geminiApiKey', 'geminiModel']);

        // Если API ключ отсутствует — открываем окно настроек и прекращаем выполнение
        if (!geminiApiKey) {
            logger.warn('API ключ отсутствует, открываем страницу настроек');
            chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') });
            return;
        }

        const textForPrompt = componentsData
            .map(c => JSON.stringify(c.data, null, 2))
            .join('\n\n---\n\n');

        logger.info('Начало обработки предложения из компонентов', {
            model: geminiModel,
            componentsCount: componentsData.length,
            promptLength: textForPrompt.length
        });

        const result = await GeminiAPI.getFullPriceOffer(textForPrompt, geminiApiKey, geminiModel);

        await chrome.storage.local.set({ lastOffer: result });

        logger.info('Результат успешно получен и сохранен как lastOffer');

        const formattedResult = JSON.stringify(JSON.parse(result), null, 2);
        await showResultToUser(tabId, formattedResult);
        await saveOffer(tabId, result);

    } catch (ex) {
        logger.error('Ошибка при работе с Gemini API', {
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
 * 
 * Args:
 *     tab (Object): Объект вкладки Chrome
 * 
 * Returns:
 *     boolean: true если вкладка доступна, иначе false
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
    logger.info('Расширение установлено/обновлено');
    await menuManager.initialize();
});

/**
 * Состояние обработчика меню
 */
const MenuClickState = {
    lastClickTime: 0,
    lastMenuItemId: null,
    processing: false
};

/**
 * Глобальный обработчик кликов по контекстному меню
 * Единственное место обработки всех событий меню
 * Реализован debounce для предотвращения множественных кликов
 */
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    const DEBOUNCE_TIME = 500; // мс
    const now = Date.now();
    const timeSinceLastClick = now - MenuClickState.lastClickTime;

    logger.debug('Клик по меню', {
        menuItemId: info.menuItemId,
        timeSinceLastClick: timeSinceLastClick,
        processing: MenuClickState.processing
    });

    // Debounce: игнорируем быстрые повторные клики на тот же пункт меню
    if (MenuClickState.processing &&
        info.menuItemId === MenuClickState.lastMenuItemId &&
        timeSinceLastClick < DEBOUNCE_TIME) {
        logger.warn('Клик проигнорирован - debounce активен', {
            menuItemId: info.menuItemId,
            timeSinceLastClick: timeSinceLastClick
        });
        return;
    }

    // Блокировка одновременных обработок
    if (MenuClickState.processing) {
        logger.warn('Блокировка повторного клика - обработка уже выполняется');
        return;
    }

    MenuClickState.processing = true;
    MenuClickState.lastClickTime = now;
    MenuClickState.lastMenuItemId = info.menuItemId;

    try {
        if (!isTabAccessible(tab)) {
            UIManager.showNotification(
                'Price Offer Generator',
                'Действие недоступно на этой странице.'
            );
            logger.warn('Попытка использования на недоступной странице', { url: tab.url });
            return;
        }

        const menuItemId = info.menuItemId;
        const MENU_CONFIG = MenuManager.CONFIG;

        logger.info('Обработка клика по пункту меню', {
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
    } catch (ex) {
        logger.error('Ошибка обработки клика по меню', {
            error: ex.message,
            stack: ex.stack,
            menuItemId: info.menuItemId
        });
    } finally {
        // Сброс флага обработки
        setTimeout(() => {
            MenuClickState.processing = false;
            logger.debug('Флаг обработки меню сброшен');
        }, 100);
    }
});

logger.info('Background script инициализирован и готов к работе');

/**
 * Отладочные функции для диагностики
 * Доступны в консоли background script
 */

/**
 * Проверка всех открытых вкладок preview-offer.html
 */
self.checkPreviewTabs = async function () {
    const previewUrl = chrome.runtime.getURL('preview-offer.html');
    const tabs = await chrome.tabs.query({ url: previewUrl });

    logger.debug('=== ПРОВЕРКА ВКЛАДОК PREVIEW-OFFER ===');
    logger.debug(`Найдено вкладок: ${tabs.length}`);

    if (tabs.length > 0) {
        logger.debug('Список вкладок:');
        tabs.forEach((tab, index) => {
            logger.debug(`  ${index + 1}. Tab ID: ${tab.id}, Window ID: ${tab.windowId}, Active: ${tab.active}`);
        });
    }

    return tabs;
};

/**
 * Проверка состояния
 */
self.checkState = function () {
    logger.debug('=== ПРОВЕРКА СОСТОЯНИЯ ===');
    logger.debug('MenuClickState:', {
        processing: MenuClickState.processing,
        lastClickTime: MenuClickState.lastClickTime,
        lastMenuItemId: MenuClickState.lastMenuItemId,
        timeSinceLastClick: Date.now() - MenuClickState.lastClickTime
    });

    if (typeof previewTabMutex !== 'undefined') {
        logger.debug('previewTabMutex:', {
            locked: previewTabMutex.locked,
            waitingCount: previewTabMutex.waiting.length
        });
    } else {
        logger.debug('previewTabMutex: НЕ ОПРЕДЕЛЕН (проверьте handlers.js)');
    }
};

/**
 * Закрытие всех дублирующих вкладок
 */
self.closeAllPreviewTabs = async function () {
    const tabs = await self.checkPreviewTabs();

    if (tabs.length <= 1) {
        logger.debug('Дублирующих вкладок не найдено');
        return;
    }

    logger.debug(`Закрытие ${tabs.length - 1} дублирующих вкладок...`);

    for (let i = 1; i < tabs.length; i++) {
        await chrome.tabs.remove(tabs[i].id);
        logger.debug(`Закрыта вкладка ${tabs[i].id}`);
    }

    logger.debug('Все дублирующие вкладки закрыты');
};

/**
 * Полная диагностика
 */
self.fullDiagnostic = async function () {
    logger.debug('\n╔════════════════════════════════════════════╗');
    logger.debug('║   ПОЛНАЯ ДИАГНОСТИКА РАСШИРЕНИЯ           ║');
    logger.debug('╚════════════════════════════════════════════╝\n');

    await self.checkPreviewTabs();
    logger.debug('');
    self.checkState();
    logger.debug('');

    const storage = await chrome.storage.local.get([
        'addedComponents',
        'componentsForOffer',
        'previewOfferTabId'
    ]);

    logger.debug('=== ПРОВЕРКА STORAGE ===');
    logger.debug('addedComponents:', storage.addedComponents?.length || 0);
    logger.debug('componentsForOffer:', storage.componentsForOffer?.length || 0);
    logger.debug('previewOfferTabId:', storage.previewOfferTabId);

    logger.debug('\n╔════════════════════════════════════════════╗');
    logger.debug('║   ДИАГНОСТИКА ЗАВЕРШЕНА                   ║');
    logger.debug('╚════════════════════════════════════════════╝\n');
};

/**
 * Сброс всех флагов
 */
self.resetAllFlags = function () {
    logger.debug('Принудительный сброс всех флагов...');

    MenuClickState.processing = false;
    MenuClickState.lastClickTime = 0;
    MenuClickState.lastMenuItemId = null;
    logger.debug('✓ MenuClickState сброшен');

    if (typeof previewTabMutex !== 'undefined') {
        previewTabMutex.locked = false;
        previewTabMutex.waiting = [];
        logger.debug('✓ previewTabMutex сброшен');
    } else {
        logger.debug('⚠ previewTabMutex не определен');
    }

    logger.debug('Все флаги сброшены');
};

// Вывод доступных команд с задержкой, чтобы они были видны после инициализации
setTimeout(() => {
    logger.debug('\n╔════════════════════════════════════════════╗');
    logger.debug('║   ОТЛАДОЧНЫЕ КОМАНДЫ ДОСТУПНЫ             ║');
    logger.debug('╚════════════════════════════════════════════╝');
    logger.debug('');
    logger.debug('Доступные команды:');
    logger.debug('  - fullDiagnostic()      : Полная диагностика');
    logger.debug('  - checkPreviewTabs()    : Проверка вкладок preview-offer');
    logger.debug('  - checkState()          : Проверка состояния');
    logger.debug('  - closeAllPreviewTabs() : Закрыть все дублирующие вкладки');
    logger.debug('  - resetAllFlags()       : Сброс всех флагов');
    logger.debug('');
    logger.debug('Тест: Попробуйте выполнить fullDiagnostic()');
    logger.debug('');
}, 100);