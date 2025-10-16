// background.js
// \file background.js
// -*- coding: utf-8 -*-

/**
 * Модуль фоновой службы расширения
 * =================================
 * Оркестрация событий и управление основной логикой расширения
 */

importScripts('logger.js', 'ui-manager.js', 'gemini.js', 'menu.js', 'handlers.js');

// ▼▼▼ ИЗМЕНЕНИЕ ЗДЕСЬ ▼▼▼
// Строка `const logger = new Logger(...)` была полностью УДАЛЕНА.
// Теперь мы используем объект `logger`, который был создан внутри logger.js

const menuManager = new MenuManager(logger); // Эта строка теперь работает правильно

const MenuClickState = {
    lastClickTime: 0,
    lastMenuItemId: null,
    processing: false
};

const DEBOUNCE_TIME = 500;

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

function isTabAccessible(tab) {
    if (!tab || !tab.url) return false;
    const restrictedProtocols = ['chrome://', 'edge://', 'about:', 'file://'];
    return !restrictedProtocols.some(protocol => tab.url.startsWith(protocol));
}

chrome.runtime.onInstalled.addListener(async () => {
    logger.info('Расширение установлено/обновлено');
    await menuManager.initialize();
});

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

        if (menuItemId.startsWith('generate-offer-lang-')) {
            const lang = menuItemId.split('-').pop();
            await handleGenerateOffer(tab, lang === 'default' ? null : lang);
            return;
        }

    } catch (ex) {
        logger.error('Ошибка обработки клика по меню', {
            error: ex.message,
            stack: ex.stack,
            menuItemId: info.menuItemId
        });
    } finally {
        setTimeout(() => {
            MenuClickState.processing = false;
            logger.debug('Флаг обработки меню сброшен');
        }, 100);
    }
});


/**
 * Отладочные функции для диагностики
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

    logger.debug('Все флаги сброшены');
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