// menu.js

/**
 * Модуль для управления контекстным меню расширения
 * ==================================================
 */
class MenuManager {
    static CONFIG = {
        GENERATE_OFFER_FROM_COMPONENTS_ID: 'generate-offer-from-components',
        ADD_COMPONENT_ID: 'add-component-action',
        SAVED_COMPONENTS_PARENT_ID: 'saved-components-parent',
        SAVED_OFFERS_PARENT_ID: 'saved-offers-parent',
        NO_SAVED_OFFERS_ID: 'no-saved-offers'
    };

    static STORAGE_KEY = 'addedComponents';

    constructor(logger) {
        this.logger = logger;
    }

    async initialize() {
        chrome.contextMenus.removeAll();

        chrome.contextMenus.create({
            id: MenuManager.CONFIG.ADD_COMPONENT_ID,
            title: 'Добавить компонент',
            contexts: ['page']
        });

        await this._createSavedComponentsMenu();

        chrome.contextMenus.create({ id: 'separator-1', type: 'separator', contexts: ['page'] });

        await this._createSavedOffersMenu();

        this._initializeClickHandler();
    }

    async _createSavedOffersMenu() {
        // --- Пункт меню "Сохраненные предложения" закомментирован ---
        // chrome.contextMenus.create({ 
        //     id: MenuManager.CONFIG.SAVED_OFFERS_PARENT_ID, 
        //     title: 'Сохраненные предложения', 
        //     contexts: ['page'] 
        // });

        const { savedOffers = {} } = await chrome.storage.local.get('savedOffers');

        // --- Закомментирован весь блок создания дочерних элементов ---
        /*
        if (Object.keys(savedOffers).length === 0) {
            chrome.contextMenus.create({
                id: MenuManager.CONFIG.NO_SAVED_OFFERS_ID,
                parentId: MenuManager.CONFIG.SAVED_OFFERS_PARENT_ID,
                title: '(пока пусто)',
                enabled: false,
                contexts: ['page']
            });
        } else {
            for (const [offerId, offer] of Object.entries(savedOffers)) {
                chrome.contextMenus.create({
                    id: offerId,
                    parentId: MenuManager.CONFIG.SAVED_OFFERS_PARENT_ID,
                    title: offer.name,
                    contexts: ['page']
                });
            }
        }
        */

        await this.logger.info(`Загружено ${Object.keys(savedOffers).length} сохраненных предложений в меню`);
    }

    async _createSavedComponentsMenu() {
        const { [MenuManager.STORAGE_KEY]: components = [] } = await chrome.storage.local.get(MenuManager.STORAGE_KEY);

        if (components.length > 0) {
            chrome.contextMenus.create({
                id: MenuManager.CONFIG.SAVED_COMPONENTS_PARENT_ID,
                title: 'Сохраненные компоненты',
                contexts: ['page']
            });

            chrome.contextMenus.create({
                id: MenuManager.CONFIG.GENERATE_OFFER_FROM_COMPONENTS_ID,
                parentId: MenuManager.CONFIG.SAVED_COMPONENTS_PARENT_ID,
                title: 'Сформировать предложение цены',
                contexts: ['page']
            });

            chrome.contextMenus.create({
                id: 'components-action-separator',
                parentId: MenuManager.CONFIG.SAVED_COMPONENTS_PARENT_ID,
                type: 'separator',
                contexts: ['page']
            });

            for (const component of components) {
                chrome.contextMenus.create({
                    id: component.id,
                    parentId: MenuManager.CONFIG.SAVED_COMPONENTS_PARENT_ID,
                    title: component.name,
                    contexts: ['page']
                });

                chrome.contextMenus.create({
                    id: `delete-${component.id}`,
                    parentId: component.id,
                    title: '❌ Удалить',
                    contexts: ['page']
                });
            }
        }

        await this.logger.info(`Загружено ${components.length} сохраненных компонентов в меню`);
    }

    async addSavedOfferItem(offerId, offerName) {
        try { await chrome.contextMenus.remove(MenuManager.CONFIG.NO_SAVED_OFFERS_ID); } catch { }

        // --- Пункт добавления отдельного предложения оставляем на будущее ---
        // chrome.contextMenus.create({
        //     id: offerId,
        //     parentId: MenuManager.CONFIG.SAVED_OFFERS_PARENT_ID,
        //     title: offerName,
        //     contexts: ['page']
        // });

        await this.logger.info(`Пункт меню "${offerName}" добавлен.`);
    }

    async refreshMenu() { await this.initialize(); }

    _initializeClickHandler() {
        chrome.contextMenus.onClicked.addListener(async (info, tab) => {
            try {
                switch (info.menuItemId) {

                    // --- Основное: открыть preview-offer.html с компонентами ---
                    case MenuManager.CONFIG.GENERATE_OFFER_FROM_COMPONENTS_ID:
                        // Получаем все добавленные компоненты
                        const { [MenuManager.STORAGE_KEY]: components = [] } = await chrome.storage.local.get(MenuManager.STORAGE_KEY);

                        // Сохраняем их в отдельный ключ для preview-offer.html
                        await chrome.storage.local.set({ 'componentsForOffer': components });

                        // Проверяем, есть ли уже вкладка с preview-offer.html
                        chrome.tabs.query({}, (tabs) => {
                            const existingTab = tabs.find(tab => tab.url && tab.url.endsWith('preview-offer.html'));
                            if (existingTab) {
                                chrome.tabs.update(existingTab.id, { active: true });
                            } else {
                                chrome.tabs.create({ url: chrome.runtime.getURL('preview-offer.html') });
                            }
                        });

                        await this.logger.info('Открыт файл preview-offer.html с компонентами');
                        break;

                    case MenuManager.CONFIG.ADD_COMPONENT_ID:
                        await this.logger.info('Выбран пункт "Добавить компонент"');
                        break;

                    default:
                        if (info.menuItemId.startsWith('delete-')) {
                            const componentId = info.menuItemId.replace('delete-', '');
                            const { [MenuManager.STORAGE_KEY]: components = [] } = await chrome.storage.local.get(MenuManager.STORAGE_KEY);
                            const updatedComponents = components.filter(c => c.id !== componentId);
                            await chrome.storage.local.set({ [MenuManager.STORAGE_KEY]: updatedComponents });
                            await this.logger.info(`Компонент ${componentId} удален`);
                            this.refreshMenu();
                        }
                        break;
                }
            } catch (ex) {
                await this.logger.error('Ошибка при клике по пункту меню', ex, { exc_info: true });
            }
        });
    }
}
