// background.js

/**
 * Модуль фоновой службы расширения
 * =================================
 * Оркестрация событий и управление основной логикой расширения
 */

importScripts('logger.js', 'ui-manager.js', 'gemini.js', 'menu.js');

const logger = new Logger('__kazarinov_logs__', 100);
const menuManager = new MenuManager(logger);

/**
 * Отображение результата пользователю
 * Функция проверяет наличие content script и отображает результат
 * через модальное окно или inject script
 * 
 * Args:
 *     tabId (number): ID вкладки
 *     summary (string): Текст результата для отображения
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
 * Функция запрашивает название и сохраняет предложение в storage
 * 
 * Args:
 *     tabId (number): ID вкладки
 *     result (string): JSON-данные предложения
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
 * Функция формирует промпт из компонентов и отправляет запрос к Gemini
 * 
 * Args:
 *     componentsData (Array): Массив объектов компонентов с данными
 *     tabId (number): ID вкладки для отображения результата
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
 * Проверка доступности вкладки для работы расширения
 * Функция проверяет, можно ли выполнять операции на данной странице
 * 
 * Args:
 *     tab (Object): Объект вкладки Chrome
 * 
 * Returns:
 *     boolean: true если вкладка доступна, false в противном случае
 */
function isTabAccessible(tab) {
    if (!tab || !tab.url) {
        return false;
    }

    const restrictedProtocols = ['chrome://', 'edge://', 'about:', 'file://'];
    const isRestricted = restrictedProtocols.some(protocol => tab.url.startsWith(protocol));

    return !isRestricted;
}

/**
 * Обработчик установки/обновления расширения
 * Функция инициализирует меню при первом запуске
 */
chrome.runtime.onInstalled.addListener(async () => {
    await logger.info('Расширение установлено/обновлено');
    await menuManager.initialize();
});

/**
 * Обработчик кликов по контекстному меню
 * Главный обработчик всех действий пользователя через меню
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

/**
 * Обработка добавления компонента
 * Функция извлекает данные со страницы и сохраняет как компонент
 * 
 * Args:
 *     tab (Object): Объект вкладки Chrome
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
            func: (locators) => {
                /**
                 * Извлечение значения элемента по локатору
                 */
                function getElementValue(locator) {
                    const { by, selector, attribute, if_list, mandatory, locator_description } = locator;
                    let elements = [];

                    try {
                        if (by === 'XPATH') {
                            const iterator = document.evaluate(
                                selector,
                                document,
                                null,
                                XPathResult.ORDERED_NODE_ITERATOR_TYPE,
                                null
                            );
                            let node = iterator.iterateNext();
                            while (node) {
                                elements.push(node);
                                node = iterator.iterateNext();
                            }
                        } else if (by === 'ID') {
                            const el = document.getElementById(selector);
                            if (el) {
                                elements.push(el);
                            }
                        } else if (by === 'CLASS') {
                            elements = Array.from(document.getElementsByClassName(selector));
                        } else if (by === 'CSS_SELECTOR') {
                            elements = Array.from(document.querySelectorAll(selector));
                        }

                        if (!elements.length) {
                            if (mandatory) {
                                console.error(`Обязательный локатор не найден: ${locator_description}`);
                            }
                            return if_list === 'all' ? [] : null;
                        }

                        if (if_list === 'all') {
                            return elements.map(el => el[attribute] ?? el.getAttribute(attribute));
                        } else {
                            return elements[0][attribute] ?? elements[0].getAttribute(attribute);
                        }
                    } catch (ex) {
                        console.error(`Ошибка извлечения локатора ${locator_description}:`, ex);
                        return if_list === 'all' ? [] : null;
                    }
                }

                /**
                 * Выполнение всех локаторов
                 */
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
                err_msg = 'Не удалось определить имя компонента.\nПолученные данные: ' + componentName + '\nтип: ' + typeof (componentName);
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
 * Функция удаляет компонент из хранилища и обновляет меню
 * 
 * Args:
 *     menuItemId (string): ID пункта меню (формат: delete-component_XXXX)
 */
async function handleDeleteComponent(menuItemId) {
    const componentId = menuItemId.replace('delete-', '');
    await logger.info('Запрос на удаление компонента', { componentId: componentId });

    try {
        const { [MenuManager.STORAGE_KEY]: components = [] } = await chrome.storage.local.get(MenuManager.STORAGE_KEY);
        const updatedComponents = components.filter(c => c.id !== componentId);

        await chrome.storage.local.set({ [MenuManager.STORAGE_KEY]: updatedComponents });
        await logger.info('Компонент удален из хранилища', { componentId: componentId });

        await menuManager.refreshMenu();

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
 * Функция копирует данные компонента в буфер обмена
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
            await logger.error('Сохраненный компонент не найден', { componentId: menuItemId });
            UIManager.showError(tab.id, 'Ошибка: компонент не найден', 4000, true);
            return;
        }

        await logger.info('Копирование JSON компонента', { componentName: foundComponent.name });

        const componentJson = JSON.stringify(foundComponent.data, null, 2);

        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (textToCopy) => {
                navigator.clipboard.writeText(textToCopy);
            },
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
 * Функция отображает ранее сохраненное предложение
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
 * Функция открывает новую вкладку с предпросмотром компонентов
 * 
 * Args:
 *     tab (Object): Объект вкладки Chrome
 */
async function handleGenerateOffer(tab) {
    try {
        const { [MenuManager.STORAGE_KEY]: components = [] } = await chrome.storage.local.get(MenuManager.STORAGE_KEY);

        if (components.length === 0) {
            UIManager.showError(tab.id, 'Нет сохраненных компонентов для формирования предложения', 4000, true);
            await logger.warn('Попытка сформировать предложение без компонентов');
            return;
        }

        await logger.info('Открытие страницы предпросмотра предложения', {
            componentsCount: components.length
        });

        chrome.tabs.create({
            url: chrome.runtime.getURL('preview-offer.html'),
            active: true
        });

    } catch (ex) {
        await logger.error('Ошибка открытия страницы предложения', {
            error: ex.message,
            stack: ex.stack
        });
        UIManager.showError(tab.id, 'Ошибка открытия предложения', 4000, true);
    }
}

logger.info('Background script инициализирован и готов к работе');