// handlers.js
// Все функции используют глобальные logger и menuManager
// Не импортируем logger и menuManager заново

/**
 * Обработка добавления компонента
 */
async function handleAddComponent(tab) {
    UIManager.showIndicator(tab.id, 'Извлечение данных...');
    await logger.info('Начало извлечения данных по локаторам', { tabId: tab.id });

    try {
        const url = new URL(tab.url);
        const hostname = url.hostname.replace(/^www\./, '');
        const locatorPath = `locators/${hostname}.json`;

        const response = await fetch(chrome.runtime.getURL(locatorPath));

        if (!response.ok) {
            throw new Error(`Не удалось загрузить локаторы для ${hostname}`);
        }

        const locators = await response.json();

        await logger.debug('Локаторы загружены', {
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

                    await logger.error('Ошибка извлечения компонента', { error: errorMsg });
                    UIManager.showError(tab.id, 'Не удалось извлечь данные', 4000, true);
                    return;
                }

                const data = results[0].result;
                const componentName = data.name;

                if (!componentName || typeof componentName !== 'string' || componentName.trim() === '') {
                    const err_msg = 'Не удалось определить имя компонента.\nПолученные данные: ' + componentName;
                    await logger.error(err_msg, { data: data });
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

                await logger.info('Компонент успешно добавлен', {
                    componentId: newComponent.id,
                    componentName: newComponent.name
                });
            });
        });

    } catch (ex) {
        UIManager.hideIndicator(tab.id);
        await logger.error('Ошибка загрузки или обработки локаторов', {
            error: ex.message,
            stack: ex.stack
        });
        UIManager.showError(tab.id, `Ошибка: ${ex.message}`, 4000, true);
    }
}

/**
 * Обработка удаления компонента
 */
async function handleDeleteComponent(menuItemId) {
    const componentId = menuItemId.replace('delete-', '');
    await logger.info('Запрос на удаление компонента', { componentId: componentId });

    try {
        const { [MenuManager.STORAGE_KEY]: components = [] } = await chrome.storage.local.get(MenuManager.STORAGE_KEY);
        const updatedComponents = components.filter(c => c.id !== componentId);

        await chrome.storage.local.set({ [MenuManager.STORAGE_KEY]: updatedComponents });
        await menuManager.refreshMenu();

        await logger.info('Компонент удален из хранилища', { componentId: componentId });

    } catch (ex) {
        await logger.error('Ошибка удаления компонента', {
            componentId: componentId,
            error: ex.message,
            stack: ex.stack
        });
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
            await logger.error('Сохраненный компонент не найден', { componentId: menuItemId });
            UIManager.showError(tab.id, 'Ошибка: компонент не найден', 4000, true);
            return;
        }

        await logger.info('Копирование JSON компонента', { componentName: foundComponent.name });

        const componentJson = JSON.stringify(foundComponent.data, null, 2);

        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (textToCopy) => navigator.clipboard.writeText(textToCopy),
            args: [componentJson]
        });

        UIManager.showError(tab.id, `JSON компонента "${foundComponent.name}" скопирован!`, 2500, false);

    } catch (ex) {
        await logger.error('Ошибка копирования компонента', {
            componentId: menuItemId,
            error: ex.message,
            stack: ex.stack
        });
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
            await logger.error('Сохраненное предложение не найдено', { offerId: menuItemId });
            UIManager.showError(tab.id, 'Ошибка: предложение не найдено', 4000, true);
            return;
        }

        await logger.info('Загрузка сохраненного предложения', { offerName: savedOffer.name });

        const formattedOffer = JSON.stringify(JSON.parse(savedOffer.data), null, 2);
        await showResultToUser(tab.id, formattedOffer);

    } catch (ex) {
        await logger.error('Ошибка загрузки сохраненного предложения', {
            offerId: menuItemId,
            error: ex.message,
            stack: ex.stack
        });
        UIManager.showError(tab.id, 'Ошибка загрузки предложения', 4000, true);
    }
}

/**
 * Обработка формирования предложения из компонентов
 */
async function handleGenerateOffer(tab) {
    try {
        const { [MenuManager.STORAGE_KEY]: components = [] } = await chrome.storage.local.get(MenuManager.STORAGE_KEY);

        if (components.length === 0) {
            UIManager.showError(tab.id, 'Нет сохраненных компонентов для формирования предложения', 4000, true);
            await logger.warn('Попытка сформировать предложение без компонентов');
            return;
        }

        await chrome.storage.local.set({ componentsForOffer: components });

        await logger.info('Открытие страницы предпросмотра предложения', {
            componentsCount: components.length
        });

        chrome.tabs.query({ url: chrome.runtime.getURL('preview-offer.html') }, (tabs) => {
            if (tabs.length > 0) {
                chrome.tabs.update(tabs[0].id, { active: true });
            } else {
                chrome.tabs.create({
                    url: chrome.runtime.getURL('preview-offer.html'),
                    active: true
                });
            }
        });

    } catch (ex) {
        await logger.error('Ошибка открытия страницы предложения', {
            error: ex.message,
            stack: ex.stack
        });
        UIManager.showError(tab.id, 'Ошибка открытия предложения', 4000, true);
    }
}

// Экспортируем функции в глобальный объект, чтобы background.js мог их использовать
self.handleAddComponent = handleAddComponent;
self.handleDeleteComponent = handleDeleteComponent;
self.handleCopyComponent = handleCopyComponent;
self.handleLoadOffer = handleLoadOffer;
self.handleGenerateOffer = handleGenerateOffer;
