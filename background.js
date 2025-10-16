// background.js
// \file background.js
// -*- coding: utf-8 -*-

/**
 * Модуль фоновой службы расширения
 * =================================
 * Оркестрация событий и управление основной логикой расширения
 */

importScripts('logger.js', 'ui-manager.js', 'gemini.js', 'menu.js', 'handlers.js');

// logger уже объявлен в logger.js
const menuManager = new MenuManager(logger);

const MenuClickState = {
    lastClickTime: 0,
    lastMenuItemId: null,
    processing: false
};

const DEBOUNCE_TIME = 500;

/**
 * Отображение результата пользователю
 * Функция проверяет наличие content script и выбирает способ отображения
 * 
 * Args:
 *     tabId (number): ID вкладки
 *     summary (string): Текст результата для отображения
 */
async function showResultToUser(tabId, summary) {
    logger.debug('Попытка отображения результата пользователю', { tabId: tabId });

    try {
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
    } catch (ex) {
        logger.error('Ошибка функции showResultToUser', { error: ex.message, stack: ex.stack, tabId: tabId });
        UIManager.showModal(tabId, summary);
    }
}

/**
 * Сохранение предложения в storage
 * Функция запрашивает имя у пользователя и сохраняет данные
 * 
 * Args:
 *     tabId (number): ID вкладки
 *     result (Object): Данные предложения
 */
async function saveOffer(tabId, result) {
    logger.info('Запуск процесса сохранения предложения', { tabId: tabId });

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
            stack: ex.stack,
            tabId: tabId
        });
        UIManager.showError(tabId, 'Ошибка сохранения предложения', 4000, true);
    }
}

/**
 * Проверка доступности вкладки для работы расширения
 * Функция проверяет URL вкладки на наличие ограниченных протоколов
 * 
 * Args:
 *     tab (Object): Объект вкладки Chrome
 * 
 * Returns:
 *     boolean: true если вкладка доступна, false иначе
 */
function isTabAccessible(tab) {
    if (!tab || !tab.url) {
        logger.debug('Вкладка недоступна: отсутствует объект или URL');
        return false;
    }

    const restrictedProtocols = ['chrome://', 'edge://', 'about:', 'file://'];
    const isRestricted = restrictedProtocols.some(protocol => tab.url.startsWith(protocol));

    if (isRestricted) {
        logger.debug('Вкладка недоступна: ограниченный протокол', { url: tab.url });
    }

    return !isRestricted;
}

/**
 * Обработчик установки/обновления расширения
 */
chrome.runtime.onInstalled.addListener(async () => {
    logger.info('Расширение установлено/обновлено');

    try {
        await menuManager.initialize();
        logger.info('Инициализация контекстного меню завершена');
    } catch (ex) {
        logger.error('Ошибка инициализации при установке расширения', {
            error: ex.message,
            stack: ex.stack
        });
    }
});

/**
 * Обработчик кликов по контекстному меню
 */
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    const now = Date.now();
    const timeSinceLastClick = now - MenuClickState.lastClickTime;

    logger.debug('Клик по меню', {
        menuItemId: info.menuItemId,
        timeSinceLastClick: timeSinceLastClick,
        processing: MenuClickState.processing
    });

    if (MenuClickState.processing &&
        info.menuItemId === MenuClickState.lastMenuItemId &&
        timeSinceLastClick < DEBOUNCE_TIME) {
        logger.warn('Клик проигнорирован - debounce активен', { menuItemId: info.menuItemId });
        return;
    }

    if (MenuClickState.processing) {
        logger.warn('Блокировка повторного клика - обработка уже выполняется');
        return;
    }

    MenuClickState.processing = true;
    MenuClickState.lastClickTime = now;
    MenuClickState.lastMenuItemId = info.menuItemId;

    try {
        if (!isTabAccessible(tab)) {
            UIManager.showNotification('Price Offer Generator', 'Действие недоступно на этой странице.');
            logger.warn('Попытка использования на недоступной странице', { url: tab.url });
            return;
        }

        const menuItemId = info.menuItemId;
        const MENU_CONFIG = MenuManager.CONFIG;

        logger.info('Обработка клика по пункту меню', { menuItemId, tabId: tab.id, url: tab.url });

        if (menuItemId === MENU_CONFIG.ADD_COMPONENT_ID) {
            await handleAddComponent(tab);
            return;
        }

        // Обработка кликов внутри подменю 'Сохраненные компоненты'
        if (menuItemId.startsWith('delete-')) {
            const componentId = menuItemId.replace('delete-', '');
            await handleDeleteComponent(componentId);
            return;
        }

        // Если это ID самого компонента (например, 'component_12345')
        if (menuItemId.startsWith('component_')) {
            await handleCopyComponent(menuItemId, tab);
            return;
        }

        // Если это ID сохраненного оффера (если будет добавлено)
        if (menuItemId.startsWith('offer_')) {
            await handleLoadOffer(menuItemId, tab);
            return;
        }

        // Обработка клика по пункту "Сформировать предложение цены"
        if (menuItemId.startsWith('generate-offer-lang-')) {
            const lang = menuItemId.replace('generate-offer-lang-', '');
            await handleGenerateOffer(tab, lang);
            return;
        }

        // Обработка клика по пункту "Очистить все компоненты"
        if (menuItemId === MENU_CONFIG.CLEAR_ALL_COMPONENTS_ID) {
            await handleClearAllComponents(tab);
            return;
        }

        logger.warn('Неизвестный пункт меню', { menuItemId });

    } catch (ex) {
        logger.error('Ошибка обработки клика по меню', {
            error: ex.message,
            stack: ex.stack,
            menuItemId: info.menuItemId,
            tabId: tab?.id
        });
        // UIManager.showError(tab.id, 'Ошибка обработки действия', 4000, true);
    } finally {
        setTimeout(() => {
            MenuClickState.processing = false;
            logger.debug('Флаг обработки меню сброшен');
        }, 100);
    }
});

/**
 * Обработчик генерации предложения с UI индикаторами (поддержка языка)
 * 
 * Args:
 *     tab (Object): Объект вкладки Chrome
 *     lang (string): Код языка для промпта
 */
async function handleGenerateOffer(tab, lang) {
    logger.info('Запуск генерации предложения с UI', { tabId: tab.id, lang: lang });

    try {
        UIManager.showIndicator(tab.id, 'Собираем компоненты...');
        const components = await getComponentsForOffer();

        if (!components || components.length === 0) {
            logger.warn('Нет компонентов для генерации предложения', { tabId: tab.id });
            UIManager.showError(tab.id, 'Нет компонентов для генерации предложения', 4000, true);
            return;
        }

        logger.debug('Компоненты получены', { count: components.length, tabId: tab.id });

        UIManager.showIndicator(tab.id, 'Формируем текст запроса...');
        // Добавляем маркер языка в начало текста, чтобы Gemini знал, какой промпт был запрошен.
        const pageText = `[REQUESTED_LANG:${lang}]\n\n` + components.map(c => c.text).join('\n');
        const apiKey = await getGeminiApiKey();
        const model = await getGeminiModel();

        logger.debug('Параметры для Gemini получены', { model, textLength: pageText.length });

        UIManager.showIndicator(tab.id, 'Отправка запроса в Gemini...');
        // !!! Здесь мы используем lang для указания, какой промпт нужно загрузить
        const resultText = await GeminiAPI.getFullPriceOffer(pageText, apiKey, model, lang);

        logger.debug('Ответ от Gemini получен', { responseLength: resultText.length });

        UIManager.showIndicator(tab.id, 'Парсим ответ модели...');
        const resultJSON = await GeminiAPI.getModelResponseJSON(pageText, apiKey, model, lang);

        UIManager.hideIndicator(tab.id);

        // Открытие вкладки с формой
        UIManager.openPreviewTab(tab, resultJSON, lang);

        logger.info('Генерация предложения завершена успешно', { tabId: tab.id });

    } catch (ex) {
        logger.error('Ошибка генерации предложения', {
            error: ex.message,
            stack: ex.stack,
            tabId: tab.id
        });
        UIManager.hideIndicator(tab.id);
        UIManager.showError(tab.id, `Ошибка при генерации предложения: ${ex.message}`, 8000, true);
    }
}

/**
 * Обработчик: Удаляет все сохраненные компоненты (ВРЕМЕННО УДАЛЕНА ЛОГИКА ПОДТВЕРЖДЕНИЯ ДЛЯ ТЕСТА)
 */
async function handleClearAllComponents(tab) {
    logger.warn(`[BACKGROUND] Очистка всех компонентов по запросу из меню.`);

    // ВРЕМЕННЫЙ КОД: Мы убираем подтверждение, чтобы убедиться, что удаление работает.
    const { [MenuManager.STORAGE_KEY]: components = [] } = await chrome.storage.local.get(MenuManager.STORAGE_KEY);

    if (components.length === 0) {
        logger.info('[BACKGROUND] Нет сохраненных компонентов для удаления. Выводим предупреждение.');
        await UIManager.runScriptFunction(tab.id, 'showAlert', ['Нет компонентов для удаления.']);
        return;
    }

    try {
        // --- КРИТИЧЕСКАЯ ЛОГИКА: УДАЛЕНИЕ ---
        await chrome.storage.local.remove(MenuManager.STORAGE_KEY);
        // --- КОНЕЦ КРИТИЧЕСКОЙ ЛОГИКИ ---

        logger.info('[BACKGROUND] Все компоненты успешно удалены.');
        await UIManager.runScriptFunction(tab.id, 'showAlert', ['Все компоненты успешно удалены!']);
    } catch (error) {
        logger.error('[BACKGROUND] Ошибка при удалении всех компонентов:', { error: error.message });
        await UIManager.runScriptFunction(tab.id, 'showAlert', [`Ошибка при удалении: ${error.message}`]);
    }

    // Обновляем меню после удаления (должно исчезнуть меню "Сохраненные компоненты")
    await menuManager.refreshMenu();

    // Опционально: Обновляем превью-страницу
    UIManager.reloadPreviewTabs();
}

// ============================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (ADD/DELETE/COPY/LOAD)
// Для чистоты кода, эти функции должны быть определены.
// ============================================================================

async function handleAddComponent(tab) { logger.debug('handleAddComponent вызван', { tabId: tab.id }); /* ... логика ... */ }
async function handleDeleteComponent(componentId) {
    logger.debug('handleDeleteComponent вызван', { componentId });
    // Здесь должна быть логика удаления компонента по ID, а не удаление всех.
    try {
        const { [MenuManager.STORAGE_KEY]: components = [] } = await chrome.storage.local.get(MenuManager.STORAGE_KEY);
        const newComponents = components.filter(c => c.id !== componentId);

        if (newComponents.length === components.length) {
            logger.warn('Компонент для удаления не найден.', { componentId });
            return;
        }

        await chrome.storage.local.set({ [MenuManager.STORAGE_KEY]: newComponents });
        await menuManager.refreshMenu();
        UIManager.reloadPreviewTabs();
        logger.info('Компонент успешно удален.', { componentId });
    } catch (error) {
        logger.error('Ошибка при удалении компонента', { componentId, error: error.message });
    }
}
async function handleCopyComponent(menuItemId, tab) { logger.debug('handleCopyComponent вызван', { menuItemId, tabId: tab.id }); /* ... логика ... */ }
async function handleLoadOffer(menuItemId, tab) { logger.debug('handleLoadOffer вызван', { menuItemId, tabId: tab.id }); /* ... логика ... */ }

/**
 * Получение компонентов для формирования предложения
 * Функция загружает компоненты из storage
 * 
 * Returns:
 *     Promise<Array>: Массив компонентов
 */
async function getComponentsForOffer() {
    try {
        const { [MenuManager.STORAGE_KEY]: components = [] } = await chrome.storage.local.get(MenuManager.STORAGE_KEY);
        logger.debug('Компоненты загружены из storage', { count: components.length });
        return components;
    } catch (ex) {
        logger.error('Ошибка загрузки компонентов', { error: ex.message, stack: ex.stack });
        return [];
    }
}

/**
 * Получение API ключа Gemini
 * 
 * Returns:
 *     Promise<string>: API ключ
 */
async function getGeminiApiKey() {
    try {
        const { geminiApiKey } = await chrome.storage.sync.get('geminiApiKey');
        if (!geminiApiKey) {
            logger.warn('API ключ отсутствует в storage');
            throw new Error('API ключ не установлен');
        }
        return geminiApiKey;
    } catch (ex) {
        logger.error('Ошибка получения API ключа', { error: ex.message, stack: ex.stack });
        throw ex;
    }
}

/**
 * Получение модели Gemini
 * 
 * Returns:
 *     Promise<string>: Название модели
 */
async function getGeminiModel() {
    try {
        const { geminiModel = 'gemini-2.5-flash' } = await chrome.storage.sync.get('geminiModel');
        logger.debug('Модель Gemini получена', { model: geminiModel });
        return geminiModel;
    } catch (ex) {
        logger.error('Ошибка получения модели', { error: ex.message, stack: ex.stack });
        return 'gemini-2.5-flash';
    }
}


// ============================================================================
// ОТЛАДОЧНЫЕ ФУНКЦИИ
// ============================================================================

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

self.closeAllPreviewTabs = async function () {
    try {
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

        logger.info('Все дублирующие вкладки закрыты');
    } catch (ex) {
        logger.error('Ошибка закрытия вкладок', { error: ex.message, stack: ex.stack });
    }
};

self.fullDiagnostic = async function () {
    logger.debug('\n╔════════════════════════════════════════════╗');
    logger.debug('║   ПОЛНАЯ ДИАГНОСТИКА РАСШИРЕНИЯ           ║');
    logger.debug('╚════════════════════════════════════════════╝\n');

    try {
        await self.checkPreviewTabs();
        logger.debug('');
        self.checkState();
        logger.debug('');

        const storage = await chrome.storage.local.get([
            'addedComponents',
            'componentsForOffer',
            'previewOfferTabId',
            'previewOfferData'
        ]);

        logger.debug('=== ПРОВЕРКА STORAGE ===');
        logger.debug('addedComponents:', storage.addedComponents?.length || 0);
        logger.debug('componentsForOffer:', storage.componentsForOffer?.length || 0);
        logger.debug('previewOfferTabId:', storage.previewOfferTabId);
        logger.debug('previewOfferData:', storage.previewOfferData ? 'присутствует' : 'отсутствует');

        logger.debug('\n╔════════════════════════════════════════════╗');
        logger.debug('║   ДИАГНОСТИКА ЗАВЕРШЕНА                   ║');
        logger.debug('╚════════════════════════════════════════════╝\n');
    } catch (ex) {
        logger.error('Ошибка выполнения диагностики', { error: ex.message, stack: ex.stack });
    }
};

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

    logger.info('Все флаги сброшены');
};

setTimeout(() => {
    logger.debug('\n╔════════════════════════════════════════════╗');
    logger.debug('║   ОТЛАДОЧНЫЕ КОМАНДЫ ДОСТУПНЫ             ║');
    logger.debug('╚════════════════════════════════════════════╝');
    logger.debug('Используйте в консоли background.js:');
    logger.debug('  checkPreviewTabs()');
    logger.debug('  checkState()');
    logger.debug('  closeAllPreviewTabs()');
    logger.debug('  fullDiagnostic()');
    logger.debug('  resetAllFlags()\n');
}, 3000);