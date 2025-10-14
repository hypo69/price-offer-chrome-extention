// handlers.js
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

    /**
     * Захват мьютекса
     * Функция блокирует выполнение до получения эксклюзивного доступа
     * 
     * Returns:
     *     Promise<void>: Промис, разрешаемый при получении доступа
     */
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

    /**
     * Освобождение мьютекса
     * Функция передает доступ следующему ожидающему или освобождает блокировку
     */
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
 * Функция извлекает данные со страницы по локаторам и сохраняет компонент
 * 
 * Args:
 *     tab (Object): Объект вкладки Chrome
 */
async function handleAddComponent(tab) {
    UIManager.showIndicator(tab.id, 'Извлечение данных...');
    logger.info('Начало извлечения данных по локаторам', { tabId: tab.id });

    try {
        const url = new URL(tab.url);
        const hostname = url.hostname.replace(/^www\./, '');
        const locatorPath = `locators/${hostname}.json`;

        const response = await fetch(chrome.runtime.getURL(locatorPath));

        if (!response.ok) {
            throw new Error(`Не удалось загрузить локаторы для ${hostname}`);
        }

        const locators = await response.json();

        logger.debug('Локаторы загружены', {
            hostname: hostname,
            locatorsCount: Object.keys(locators).length
        });

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
                    const errorMsg = chrome.runtime.lastError
                        ? chrome.runtime.lastError.message
                        : 'Данные не найдены';

                    logger.error('Ошибка извлечения компонента', { error: errorMsg });
                    UIManager.showError(tab.id, 'Не удалось извлечь данные', 4000, true);
                    return;
                }

                const data = results[0].result;
                const componentName = data.name;

                if (!componentName || typeof componentName !== 'string' || componentName.trim() === '') {
                    const err_msg = 'Не удалось определить имя компонента.\nПолученные данные: ' + componentName;
                    logger.error(err_msg, { data: data });
                    UIManager.showError(tab.id, err_msg, 4000, true);
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

                await menuManager.refreshMenu();

                UIManager.showError(tab.id, `Компонент "${componentName.trim()}" добавлен!`, 2500, false);

                logger.info('Компонент успешно добавлен', {
                    componentId: newComponent.id,
                    componentName: newComponent.name
                });
            });
        });

    } catch (ex) {
        UIManager.hideIndicator(tab.id);
        logger.error('Ошибка загрузки или обработки локаторов', {
            error: ex.message,
            stack: ex.stack
        });
        UIManager.showError(tab.id, `Ошибка: ${ex.message}`, 4000, true);
    }
}

/**
 * Обработка удаления компонента
 * Функция удаляет компонент из storage и обновляет меню
 * 
 * Args:
 *     menuItemId (string): ID пункта меню в формате 'delete-component_xxx'
 */
async function handleDeleteComponent(menuItemId) {
    const componentId = menuItemId.replace('delete-', '');
    logger.info('Запрос на удаление компонента', { componentId: componentId });

    try {
        const { [MenuManager.STORAGE_KEY]: components = [] } = await chrome.storage.local.get(MenuManager.STORAGE_KEY);
        const updatedComponents = components.filter(c => c.id !== componentId);

        await chrome.storage.local.set({ [MenuManager.STORAGE_KEY]: updatedComponents });
        await menuManager.refreshMenu();

        logger.info('Компонент удален из хранилища', { componentId: componentId });

    } catch (ex) {
        logger.error('Ошибка удаления компонента', {
            componentId: componentId,
            error: ex.message,
            stack: ex.stack
        });
    }
}

/**
 * Обработка копирования JSON компонента
 * Функция копирует данные компонента в буфер обмена в формате JSON
 * 
 * Args:
 *     menuItemId (string): ID компонента
 *     tab (Object): Объект вкладки Chrome
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
        logger.error('Ошибка копирования компонента', {
            componentId: menuItemId,
            error: ex.message,
            stack: ex.stack
        });
        UIManager.showError(tab.id, 'Ошибка копирования компонента', 4000, true);
    }
}

/**
 * Обработка загрузки сохраненного предложения
 * Функция загружает сохраненное предложение и отображает его пользователю
 * 
 * Args:
 *     menuItemId (string): ID предложения
 *     tab (Object): Объект вкладки Chrome
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
        logger.error('Ошибка загрузки сохраненного предложения', {
            offerId: menuItemId,
            error: ex.message,
            stack: ex.stack
        });
        UIManager.showError(tab.id, 'Ошибка загрузки предложения', 4000, true);
    }
}

/**
 * Обработка формирования предложения из компонентов
 * Функция проверяет наличие компонентов и открывает страницу предпросмотра
 * Использует Mutex для предотвращения race conditions
 * 
 * Args:
 *     tab (Object): Объект вкладки Chrome
 */
async function handleGenerateOffer(tab) {
    logger.info('Вызов handleGenerateOffer', {
        tabId: tab.id,
        mutexLocked: previewTabMutex.locked,
        waitingCount: previewTabMutex.waiting.length
    });

    // Захват мьютекса для эксклюзивного доступа
    await previewTabMutex.acquire();

    try {
        const { [MenuManager.STORAGE_KEY]: components = [] } = await chrome.storage.local.get(MenuManager.STORAGE_KEY);

        if (components.length === 0) {
            UIManager.showError(tab.id, 'Нет сохраненных компонентов для формирования предложения', 4000, true);
            logger.warn('Попытка сформировать предложение без компонентов');
            return;
        }

        await chrome.storage.local.set({ componentsForOffer: components });
        logger.info('Сохранены компоненты для предложения', { componentsCount: components.length });

        const previewUrl = chrome.runtime.getURL('preview-offer.html');

        // Поиск существующих вкладок
        const existingTabs = await chrome.tabs.query({ url: previewUrl });

        logger.debug('Результат поиска вкладок', {
            foundCount: existingTabs.length,
            tabIds: existingTabs.map(t => t.id)
        });

        if (existingTabs.length > 0) {
            // Активация первой найденной вкладки
            const targetTab = existingTabs[0];
            logger.info('Активация существующей вкладки preview-offer', {
                tabId: targetTab.id,
                windowId: targetTab.windowId
            });

            await chrome.tabs.update(targetTab.id, { active: true });
            await chrome.windows.update(targetTab.windowId, { focused: true });

            // Перезагрузка вкладки для обновления данных
            await chrome.tabs.reload(targetTab.id);
        } else {
            // Создание новой вкладки
            logger.info('Создание новой вкладки preview-offer');
            const newTab = await chrome.tabs.create({
                url: previewUrl,
                active: true
            });
            await chrome.storage.local.set({ previewOfferTabId: newTab.id });
            logger.info('Создана новая вкладка preview-offer', { tabId: newTab.id });
        }

    } catch (ex) {
        logger.error('Ошибка открытия страницы предложения', {
            error: ex.message,
            stack: ex.stack
        });
        UIManager.showError(tab.id, 'Ошибка открытия предложения', 4000, true);
    } finally {
        // Освобождение мьютекса
        previewTabMutex.release();
    }
}

// Экспорт функций в глобальный объект для использования в background.js
self.handleAddComponent = handleAddComponent;
self.handleDeleteComponent = handleDeleteComponent;
self.handleCopyComponent = handleCopyComponent;
self.handleLoadOffer = handleLoadOffer;
self.handleGenerateOffer = handleGenerateOffer;
self.previewTabMutex = previewTabMutex;