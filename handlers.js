// handlers.js
// \file handlers.js
// -*- coding: utf-8 -*-

class Mutex {
    constructor() {
        this.locked = false;
        this.waiting = [];
    }

    async acquire() {
        if (!this.locked) {
            this.locked = true;
            logger.debug('Mutex захвачен');
            return;
        }
        logger.debug('Ожидание освобождения Mutex');
        await new Promise(resolve => {
            this.waiting.push(resolve);
        });
    }

    release() {
        if (this.waiting.length > 0) {
            const resolve = this.waiting.shift();
            logger.debug('Mutex передан следующему ожидающему');
            resolve();
        } else {
            this.locked = false;
            logger.debug('Mutex освобожден');
        }
    }
}

const previewTabMutex = new Mutex();

/**
 * Добавление компонента
 */
async function handleAddComponent(tab) {
    UIManager.showIndicator(tab.id, 'Извлечение данных...');
    logger.info('Начало извлечения данных по локаторам', { tabId: tab.id });

    try {
        const url = new URL(tab.url);
        const hostname = url.hostname.replace(/^www\./, '');
        const locatorPath = `locators/${hostname}.json`;
        const response = await fetch(chrome.runtime.getURL(locatorPath));
        if (!response.ok) throw new Error(`Не удалось загрузить локаторы для ${hostname}`);
        const locators = await response.json();

        logger.debug('Локаторы загружены', { hostname, locatorsCount: Object.keys(locators).length });

        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['execute-locators.js']
        }, () => {
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: (locators) => window.executeLocators(locators),
                args: [locators]
            }, async (results) => {
                UIManager.hideIndicator(tab.id);

                if (chrome.runtime.lastError || !results || !results[0]?.result) {
                    const errorMsg = chrome.runtime.lastError?.message || 'Данные не найдены';
                    logger.error('Ошибка извлечения компонента', { error: errorMsg });
                    UIManager.showError(tab.id, 'Не удалось извлечь данные', 4000, true);
                    return;
                }

                const data = results[0].result;
                const componentName = data.name;

                if (!componentName || typeof componentName !== 'string' || componentName.trim() === '') {
                    const err_msg = 'Не удалось определить имя компонента.\nПолученные данные: ' + componentName;
                    logger.error(err_msg, { data });
                    UIManager.showError(tab.id, err_msg, 4000, true);
                    return;
                }

                const newComponent = {
                    id: `component_${Date.now()}`,
                    name: componentName.trim(),
                    data
                };

                const { [MenuManager.STORAGE_KEY]: components = [] } = await chrome.storage.local.get(MenuManager.STORAGE_KEY);
                components.push(newComponent);
                await chrome.storage.local.set({ [MenuManager.STORAGE_KEY]: components });

                await menuManager.refreshMenu();
                UIManager.showError(tab.id, `Компонент "${componentName.trim()}" добавлен!`, 2500, false);
                logger.info('Компонент успешно добавлен', { componentId: newComponent.id, componentName: newComponent.name });
            });
        });

    } catch (ex) {
        UIManager.hideIndicator(tab.id);
        logger.error('Ошибка загрузки или обработки локаторов', { error: ex.message, stack: ex.stack });
        UIManager.showError(tab.id, `Ошибка: ${ex.message}`, 4000, true);
    }
}

/**
 * Удаление компонента
 */
async function handleDeleteComponent(menuItemId) {
    const componentId = menuItemId.replace('delete-', '');
    logger.info('Запрос на удаление компонента', { componentId });

    try {
        const { [MenuManager.STORAGE_KEY]: components = [] } = await chrome.storage.local.get(MenuManager.STORAGE_KEY);
        const updatedComponents = components.filter(c => c.id !== componentId);
        await chrome.storage.local.set({ [MenuManager.STORAGE_KEY]: updatedComponents });

        await menuManager.refreshMenu();
        logger.info('Компонент удален из хранилища', { componentId });
    } catch (ex) {
        logger.error('Ошибка удаления компонента', { componentId, error: ex.message, stack: ex.stack });
    }
}

/**
 * Копирование компонента в буфер
 */
async function handleCopyComponent(menuItemId, tab) {
    try {
        const { [MenuManager.STORAGE_KEY]: components = [] } = await chrome.storage.local.get(MenuManager.STORAGE_KEY);
        const foundComponent = components.find(c => c.id === menuItemId);

        if (!foundComponent) {
            logger.error('Сохраненный компонент не найден', { componentId: menuItemId });
            UIManager.showError(tab.id, 'Ошибка: компонент не найден', 4000, true);
            return;
        }

        const componentJson = JSON.stringify(foundComponent.data, null, 2);

        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (textToCopy) => navigator.clipboard.writeText(textToCopy),
            args: [componentJson]
        });

        UIManager.showError(tab.id, `JSON компонента "${foundComponent.name}" скопирован!`, 2500, false);
        logger.info('Компонент скопирован', { componentName: foundComponent.name });

    } catch (ex) {
        logger.error('Ошибка копирования компонента', { componentId: menuItemId, error: ex.message, stack: ex.stack });
        UIManager.showError(tab.id, 'Ошибка копирования компонента', 4000, true);
    }
}

/**
 * Загрузка сохраненного предложения
 */
async function handleLoadOffer(menuItemId, tab) {
    try {
        const { savedOffers = {} } = await chrome.storage.local.get('savedOffers');
        const savedOffer = savedOffers[menuItemId];

        if (!savedOffer) {
            logger.error('Сохраненное предложение не найдено', { offerId: menuItemId });
            UIManager.showError(tab.id, 'Ошибка: предложение не найдено', 4000, true);
            return;
        }

        const formattedOffer = JSON.stringify(JSON.parse(savedOffer.data), null, 2);
        await showResultToUser(tab.id, formattedOffer);

        logger.info('Предложение загружено', { offerName: savedOffer.name });
    } catch (ex) {
        logger.error('Ошибка загрузки сохраненного предложения', { offerId: menuItemId, error: ex.message, stack: ex.stack });
        UIManager.showError(tab.id, 'Ошибка загрузки предложения', 4000, true);
    }
}

/**
 * Генерация предложения
 */
async function handleGenerateOffer(tab, language = null) {
    logger.info('Вызов handleGenerateOffer', { tabId: tab.id, mutexLocked: previewTabMutex.locked, selectedLanguage: language });
    await previewTabMutex.acquire();

    try {
        const { [MenuManager.STORAGE_KEY]: components = [] } = await chrome.storage.local.get(MenuManager.STORAGE_KEY);

        if (!components.length) {
            UIManager.showError(tab.id, 'Нет сохраненных компонентов', 4000, true);
            logger.warn('Попытка сформировать предложение без компонентов');
            return;
        }

        const { geminiApiKey } = await chrome.storage.sync.get('geminiApiKey');
        if (!geminiApiKey) {
            logger.warn('API ключ отсутствует, открываем страницу настроек');
            chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') });
            return;
        }

        const { geminiModel = 'gemini-2.5-flash' } = await chrome.storage.sync.get('geminiModel');

        await chrome.storage.local.remove(['previewOfferData', 'lastOffer']);
        await chrome.storage.local.set({ componentsForOffer: components, geminiApiKey, geminiModel, forceNewRequest: true });

        let previewUrl = chrome.runtime.getURL('preview-offer.html');
        if (language) previewUrl += `?lang=${language}`;

        const existingTabs = await chrome.tabs.query({ url: previewUrl });
        if (existingTabs.length > 0) {
            const targetTab = existingTabs[0];
            await chrome.tabs.update(targetTab.id, { active: true });
            await chrome.windows.update(targetTab.windowId, { focused: true });
            await chrome.tabs.reload(targetTab.id);
        } else {
            const newTab = await chrome.tabs.create({ url: previewUrl, active: true });
            await chrome.storage.local.set({ previewOfferTabId: newTab.id });
        }

    } catch (ex) {
        logger.error('Ошибка открытия вкладки предложения', { error: ex.message, stack: ex.stack });
        UIManager.showError(tab.id, 'Ошибка открытия предложения', 4000, true);
    } finally {
        previewTabMutex.release();
    }
}

/**
 * Удаление всех компонентов
 */
async function handleClearAllComponents(tab) {
    logger.warn('Запрос на очистку всех компонентов');

    try {
        const { [MenuManager.STORAGE_KEY]: components = [] } = await chrome.storage.local.get(MenuManager.STORAGE_KEY);

        if (!components.length) {
            UIManager.showError(tab.id, 'Нет компонентов для удаления', 4000, true);
            logger.info('Компоненты отсутствуют, удаление не требуется');
            return;
        }

        await chrome.storage.local.set({ [MenuManager.STORAGE_KEY]: [] });
        await menuManager.refreshMenu();
        UIManager.reloadPreviewTabs();
        UIManager.showError(tab.id, 'Все компоненты удалены!', 2500, false);
        logger.info('Все компоненты успешно удалены');

    } catch (ex) {
        logger.error('Ошибка очистки всех компонентов', { error: ex.message, stack: ex.stack });
        UIManager.showError(tab.id, 'Ошибка при удалении компонентов', 4000, true);
    }
}

// Экспорт для использования в background.js
self.handleAddComponent = handleAddComponent;
self.handleDeleteComponent = handleDeleteComponent;
self.handleCopyComponent = handleCopyComponent;
self.handleLoadOffer = handleLoadOffer;
self.handleGenerateOffer = handleGenerateOffer;
self.handleClearAllComponents = handleClearAllComponents;
self.previewTabMutex = previewTabMutex;
