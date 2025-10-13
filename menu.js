// menu.js

/**
 * Модуль для управления контекстным меню расширения
 * ==================================================
 * Инкапсулирует создание, обновление и конфигурацию меню.
 */
class MenuManager {
    // Конфигурация ID для пунктов меню
    static CONFIG = {
        CONTEXT_MENU_ID: 'generate-offer',
        // --- ИЗМЕНЕНО ---
        ADD_COMPONENT_PARENT_ID: 'add-component-parent', // Теперь это родительский пункт
        EXTRACT_AND_ADD_COMPONENT_ID: 'extract-and-add-component', // Это кнопка для действия
        // ------------------
        SAVED_OFFERS_PARENT_ID: 'saved-offers-parent',
        NO_SAVED_OFFERS_ID: 'no-saved-offers'
    };

    // Ключ для хранения добавленных компонентов
    static STORAGE_KEY = 'addedComponents';

    constructor(logger) {
        this.logger = logger;
    }

    /**
     * Полностью инициализирует или пересоздает контекстное меню.
     */
    async initialize() {
        chrome.contextMenus.removeAll();

        // 1. Создание основных пунктов
        chrome.contextMenus.create({
            id: MenuManager.CONFIG.CONTEXT_MENU_ID,
            title: chrome.i18n.getMessage('contextMenuTitle') || 'Сформировать предложение цены',
            contexts: ['page']
        });

        // 2. Создание родительского меню для компонентов
        chrome.contextMenus.create({
            id: MenuManager.CONFIG.ADD_COMPONENT_PARENT_ID,
            title: 'Добавить компонент',
            contexts: ['page']
        });

        // 2.1. Добавляем кнопку для извлечения НОВОГО компонента
        chrome.contextMenus.create({
            id: MenuManager.CONFIG.EXTRACT_AND_ADD_COMPONENT_ID,
            parentId: MenuManager.CONFIG.ADD_COMPONENT_PARENT_ID,
            title: 'Извлечь и добавить текущий компонент',
            contexts: ['page']
        });

        // 2.2. Загружаем и создаем подменю для уже добавленных компонентов
        await this._createAddedComponentsSubMenu();

        // 3. Загрузка и создание подменю для продуктов
        await this._createProductSubMenu();

        // Разделитель
        chrome.contextMenus.create({
            id: 'separator-1',
            type: 'separator',
            contexts: ['page']
        });

        // 4. Загрузка и создание меню для сохраненных предложений
        await this._createSavedOffersMenu();
    }

    /**
     * Создает подменю для продуктов из файла products.json
     * @private
     */
    async _createProductSubMenu() {
        try {
            const resp = await fetch(chrome.runtime.getURL('data/products.json'));
            if (!resp.ok) {
                await this.logger.error('Не удалось загрузить products.json', { status: resp.status });
                return;
            }
            const data = await resp.json();
            const products = data.ru?.products || [];
            products.forEach(product => {
                chrome.contextMenus.create({
                    id: `product-${product.product_id}`,
                    parentId: MenuManager.CONFIG.CONTEXT_MENU_ID,
                    title: product.product_name,
                    contexts: ['page']
                });
                chrome.contextMenus.create({
                    id: `delete-${product.product_id}`,
                    parentId: `product-${product.product_id}`,
                    title: '❌ Удалить',
                    contexts: ['page']
                });
            });
            await this.logger.info(`Контекстное меню создано с ${products.length} продуктами`);
        } catch (ex) {
            await this.logger.error('Ошибка создания контекстного меню для продуктов', { error: ex.message });
        }
    }

    /**
     * Создает меню для сохраненных предложений из chrome.storage
     * @private
     */
    async _createSavedOffersMenu() {
        chrome.contextMenus.create({
            id: MenuManager.CONFIG.SAVED_OFFERS_PARENT_ID,
            title: 'Сохраненные предложения',
            contexts: ['page']
        });

        const { savedOffers = {} } = await chrome.storage.local.get('savedOffers');
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
        await this.logger.info(`Загружено ${Object.keys(savedOffers).length} сохраненных предложений в меню`);
    }

    /**
     * Создает подменю для ранее добавленных компонентов из storage.
     * @private
     */
    async _createAddedComponentsSubMenu() {
        const { [MenuManager.STORAGE_KEY]: components = [] } = await chrome.storage.local.get(MenuManager.STORAGE_KEY);

        if (components.length > 0) {
            // Добавляем разделитель, если есть сохраненные компоненты
            chrome.contextMenus.create({
                id: 'component-separator',
                parentId: MenuManager.CONFIG.ADD_COMPONENT_PARENT_ID,
                type: 'separator',
                contexts: ['page']
            });

            for (const component of components) {
                chrome.contextMenus.create({
                    id: component.id,
                    parentId: MenuManager.CONFIG.ADD_COMPONENT_PARENT_ID,
                    title: component.name,
                    contexts: ['page']
                });
            }
        }
        await this.logger.info(`Загружено ${components.length} добавленных компонентов в меню`);
    }

    /**
     * Динамически добавляет новый пункт в меню сохраненных ПРЕДЛОЖЕНИЙ.
     * @param {string} offerId - ID нового предложения
     * @param {string} offerName - Имя нового предложения
     */
    async addSavedOfferItem(offerId, offerName) {
        // Попытаемся удалить заглушку "(пока пусто)", если она существует
        try {
            await chrome.contextMenus.remove(MenuManager.CONFIG.NO_SAVED_OFFERS_ID);
        } catch (e) {
            // Ошибки не будет, если элемента не существует, это нормально
        }

        chrome.contextMenus.create({
            id: offerId,
            parentId: MenuManager.CONFIG.SAVED_OFFERS_PARENT_ID,
            title: offerName,
            contexts: ['page']
        });
        await this.logger.info(`Пункт меню "${offerName}" добавлен.`);
    }

    /**
     * Динамически добавляет новый пункт в подменю добавленных КОМПОНЕНТОВ.
     * @param {object} component - Объект компонента {id, name, data}
     */
    async addExtractedComponentItem(component) {
        // Проверяем, нужно ли добавить разделитель (если это первый добавленный компонент)
        const { [MenuManager.STORAGE_KEY]: components = [] } = await chrome.storage.local.get(MenuManager.STORAGE_KEY);
        if (components.length === 1) { // Мы уже добавили в storage, так что проверяем на 1
            chrome.contextMenus.create({
                id: 'component-separator',
                parentId: MenuManager.CONFIG.ADD_COMPONENT_PARENT_ID,
                type: 'separator',
                contexts: ['page']
            });
        }

        chrome.contextMenus.create({
            id: component.id,
            parentId: MenuManager.CONFIG.ADD_COMPONENT_PARENT_ID,
            title: component.name,
            contexts: ['page']
        });
        await this.logger.info(`Компонент "${component.name}" добавлен в меню.`);
    }
}