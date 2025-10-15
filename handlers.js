// handlers.js
/**
 * Обработка формирования предложения из компонентов
 * НОВАЯ ЛОГИКА: Сначала открывается вкладка, затем данные загружаются через AJAX
 */
async function handleGenerateOffer(tab) {
    logger.info('═══════════════════════════════════════════════════════', {
        tabId: tab.id,
        mutexLocked: previewTabMutex.locked,
        waitingCount: previewTabMutex.waiting.length
    });
    logger.info('Вызов handleGenerateOffer');

    await previewTabMutex.acquire();

    try {
        logger.info('Загрузка компонентов из storage...');
        const { [MenuManager.STORAGE_KEY]: components = [] } = await chrome.storage.local.get(MenuManager.STORAGE_KEY);

        logger.info('Компоненты загружены из storage', {
            componentsCount: components.length,
            components: components
        });

        if (components.length === 0) {
            UIManager.showError(tab.id, 'Нет сохраненных компонентов для формирования предложения', 4000, true);
            logger.warn('Попытка сформировать предложение без компонентов');
            return;
        }

        logger.info('Проверка наличия API ключа...');
        const { geminiApiKey } = await chrome.storage.sync.get('geminiApiKey');

        logger.info('API ключ проверен', {
            hasApiKey: !!geminiApiKey,
            keyLength: geminiApiKey?.length || 0,
            keyPreview: geminiApiKey ? `${geminiApiKey.substring(0, 10)}...` : 'ОТСУТСТВУЕТ'
        });

        if (!geminiApiKey) {
            logger.warn('API ключ отсутствует, открываем страницу настроек');
            chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') });
            return;
        }

        logger.info('Получение модели из настроек...');
        const { geminiModel = 'gemini-2.5-flash' } = await chrome.storage.sync.get('geminiModel');

        logger.info('Модель получена', { model: geminiModel });

        logger.info('═══════════════════════════════════════════════════════');
        logger.info('Сохранение данных в storage для preview-offer.html');
        logger.info('═══════════════════════════════════════════════════════');

        const dataToSave = {
            componentsForOffer: components,
            geminiApiKey: geminiApiKey,
            geminiModel: geminiModel
        };

        logger.info('Данные для сохранения', {
            componentsCount: dataToSave.componentsForOffer.length,
            hasApiKey: !!dataToSave.geminiApiKey,
            model: dataToSave.geminiModel
        });

        await chrome.storage.local.set(dataToSave);

        logger.info('✅ Данные сохранены в storage успешно');

        // Проверка сохранения
        logger.info('Проверка сохраненных данных...');
        const verification = await chrome.storage.local.get([
            'componentsForOffer',
            'geminiApiKey',
            'geminiModel'
        ]);

        logger.info('Проверка сохранения:', {
            hasComponentsForOffer: !!verification.componentsForOffer,
            componentsCount: verification.componentsForOffer?.length || 0,
            hasApiKey: !!verification.geminiApiKey,
            apiKeyLength: verification.geminiApiKey?.length || 0,
            model: verification.geminiModel
        });

        logger.info('═══════════════════════════════════════════════════════');
        logger.info('Открытие/активация вкладки preview-offer.html');
        logger.info('═══════════════════════════════════════════════════════');

        const previewUrl = chrome.runtime.getURL('preview-offer.html');
        logger.info('URL вкладки preview-offer', { url: previewUrl });

        const existingTabs = await chrome.tabs.query({ url: previewUrl });
        logger.info('Поиск существующих вкладок', {
            foundCount: existingTabs.length,
            tabs: existingTabs
        });

        if (existingTabs.length > 0) {
            const targetTab = existingTabs[0];
            logger.info('Найдена существующая вкладка, активация', {
                tabId: targetTab.id,
                windowId: targetTab.windowId,
                active: targetTab.active
            });

            await chrome.tabs.update(targetTab.id, { active: true });
            await chrome.windows.update(targetTab.windowId, { focused: true });

            logger.info('Перезагрузка вкладки...');
            await chrome.tabs.reload(targetTab.id);

            logger.info('✅ Вкладка preview-offer обновлена и активирована', { tabId: targetTab.id });
        } else {
            logger.info('Создание новой вкладки preview-offer...');
            const newTab = await chrome.tabs.create({ url: previewUrl, active: true });

            await chrome.storage.local.set({ previewOfferTabId: newTab.id });

            logger.info('✅ Вкладка preview-offer создана', {
                tabId: newTab.id,
                windowId: newTab.windowId
            });
        }

        logger.info('═══════════════════════════════════════════════════════');
        logger.info('handleGenerateOffer завершен успешно');
        logger.info('═══════════════════════════════════════════════════════');

    } catch (ex) {
        logger.error('═══════════════════════════════════════════════════════');
        logger.error('❌ Ошибка в handleGenerateOffer', {
            error: ex.message,
            stack: ex.stack
        });
        logger.error('═══════════════════════════════════════════════════════');
        UIManager.showError(tab.id, 'Ошибка открытия предложения', 4000, true);
    } finally {
        previewTabMutex.release();
    }
}// handlers.js
// \file handlers.js
// -*- coding: utf-8 -*-

/**
 * Модуль обработчиков действий контекстного меню
 * ==============================================
 * Содержит функции обработки всех действий пользователя через контекстное меню
 * Все функции используют глобальные logger и menuManager из background.js
 */

/**
 * Класс Mutex для предотвращения race conditions
 * Обеспечивает эксклюзивный доступ к критическим секциям кода
 */
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

/**
 * Глобальный мьютекс для операций с preview-offer
 */
const previewTabMutex = new Mutex();

/**
 * Обработка добавления компонента
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
                args: [locators],
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

                const newComponent = { id: `component_${Date.now()}`, name: componentName.trim(), data };
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
 * Обработка удаления компонента
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
 * Обработка копирования JSON компонента
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

        logger.info('Копирование JSON компонента', { componentName: foundComponent.name });
        const componentJson = JSON.stringify(foundComponent.data, null, 2);

        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (textToCopy) => navigator.clipboard.writeText(textToCopy),
            args: [componentJson]
        });

        UIManager.showError(tab.id, `JSON компонента "${foundComponent.name}" скопирован!`, 2500, false);
    } catch (ex) {
        logger.error('Ошибка копирования компонента', { componentId: menuItemId, error: ex.message, stack: ex.stack });
        UIManager.showError(tab.id, 'Ошибка копирования компонента', 4000, true);
    }
}

/**
 * Обработка загрузки сохраненного предложения
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

        logger.info('Загрузка сохраненного предложения', { offerName: savedOffer.name });
        const formattedOffer = JSON.stringify(JSON.parse(savedOffer.data), null, 2);
        await showResultToUser(tab.id, formattedOffer);
    } catch (ex) {
        logger.error('Ошибка загрузки сохраненного предложения', { offerId: menuItemId, error: ex.message, stack: ex.stack });
        UIManager.showError(tab.id, 'Ошибка загрузки предложения', 4000, true);
    }
}

/**
 * Обработка формирования предложения из компонентов
 * НОВАЯ ЛОГИКА: Сначала открывается вкладка, затем данные загружаются через AJAX
 */
async function handleGenerateOffer(tab) {
    logger.info('Вызов handleGenerateOffer', {
        tabId: tab.id,
        mutexLocked: previewTabMutex.locked,
        waitingCount: previewTabMutex.waiting.length
    });

    await previewTabMutex.acquire();

    try {
        const { [MenuManager.STORAGE_KEY]: components = [] } = await chrome.storage.local.get(MenuManager.STORAGE_KEY);
        if (components.length === 0) {
            UIManager.showError(tab.id, 'Нет сохраненных компонентов для формирования предложения', 4000, true);
            logger.warn('Попытка сформировать предложение без компонентов');
            return;
        }

        // Проверка наличия API ключа
        const { geminiApiKey } = await chrome.storage.sync.get('geminiApiKey');
        if (!geminiApiKey) {
            logger.warn('API ключ отсутствует, открываем страницу настроек');
            chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') });
            return;
        }

        // Получаем модель из настроек
        const { geminiModel = 'gemini-2.5-flash' } = await chrome.storage.sync.get('geminiModel');

        // Сохраняем компоненты в storage для preview-offer.html
        await chrome.storage.local.set({
            componentsForOffer: components,
            geminiApiKey: geminiApiKey,
            geminiModel: geminiModel
        });

        // Открываем или активируем вкладку preview-offer
        const previewUrl = chrome.runtime.getURL('preview-offer.html');
        const existingTabs = await chrome.tabs.query({ url: previewUrl });

        if (existingTabs.length > 0) {
            const targetTab = existingTabs[0];
            await chrome.tabs.update(targetTab.id, { active: true });
            await chrome.windows.update(targetTab.windowId, { focused: true });
            await chrome.tabs.reload(targetTab.id);
            logger.info('Вкладка preview-offer обновлена и активирована', { tabId: targetTab.id });
        } else {
            const newTab = await chrome.tabs.create({ url: previewUrl, active: true });
            await chrome.storage.local.set({ previewOfferTabId: newTab.id });
            logger.info('Вкладка preview-offer создана', { tabId: newTab.id });
        }

    } catch (ex) {
        logger.error('Ошибка открытия вкладки предложения', { error: ex.message, stack: ex.stack });
        UIManager.showError(tab.id, 'Ошибка открытия предложения', 4000, true);
    } finally {
        previewTabMutex.release();
    }
}


// Экспорт функций для background.js
self.handleAddComponent = handleAddComponent;
self.handleDeleteComponent = handleDeleteComponent;
self.handleCopyComponent = handleCopyComponent;
self.handleLoadOffer = handleLoadOffer;
self.handleGenerateOffer = handleGenerateOffer;
self.previewTabMutex = previewTabMutex;