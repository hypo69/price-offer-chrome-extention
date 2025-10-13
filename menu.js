// menu.js

/**
 * Модуль для управления контекстным меню расширения
 * ==================================================
 * Инкапсулирует создание, обновление и конфигурацию меню.
 */
class MenuManager {
    // Конфигурация ID для пунктов меню
    static CONFIG = {
        // ID для "Сформировать предложение" теперь будет вложенным
        GENERATE_OFFER_FROM_COMPONENTS_ID: 'generate-offer-from-components',
        ADD_COMPONENT_ID: 'add-component-action',
        SAVED_COMPONENTS_PARENT_ID: 'saved-components-parent',
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

        // 1. Создание прямого пункта для ДОБАВЛЕНИЯ компонента
        chrome.contextMenus.create({
            id: MenuManager.CONFIG.ADD_COMPONENT_ID,
            title: 'Добавить компонент',
            contexts: ['page']
        });

        // 2. Загрузка и создание меню для сохраненных КОМПОНЕНТОВ
        // Эта функция теперь также отвечает за создание кнопки "Сформировать предложение"
        await this._createSavedComponentsMenu();

        // Разделитель
        chrome.contextMenus.create({
            id: 'separator-1',
            type: 'separator',
            contexts: ['page']
        });

        // 3. Загрузка и создание меню для сохраненных ПРЕДЛОЖЕНИЙ
        await this._createSavedOffersMenu();
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
     * Создает меню для просмотра сохраненных компонентов.
     * Если компоненты есть, также создает кнопку "Сформировать предложение".
     * @private
     */
    async _createSavedComponentsMenu() {
        const { [MenuManager.STORAGE_KEY]: components = [] } = await chrome.storage.local.get(MenuManager.STORAGE_KEY);

        if (components.length > 0) {
            // Создаем родительский пункт "Сохраненные компоненты"
            chrome.contextMenus.create({
                id: MenuManager.CONFIG.SAVED_COMPONENTS_PARENT_ID,
                title: 'Сохраненные компоненты',
                contexts: ['page']
            });

            // --- НОВАЯ ЛОГИКА: Добавляем кнопку "Сформировать предложение" ВНУТРЬ ---
            chrome.contextMenus.create({
                id: MenuManager.CONFIG.GENERATE_OFFER_FROM_COMPONENTS_ID,
                parentId: MenuManager.CONFIG.SAVED_COMPONENTS_PARENT_ID,
                title: 'Сформировать предложение цены',
                contexts: ['page']
            });

            // Добавляем разделитель
            chrome.contextMenus.create({
                id: 'components-action-separator',
                parentId: MenuManager.CONFIG.SAVED_COMPONENTS_PARENT_ID,
                type: 'separator',
                contexts: ['page']
            });
            // --- КОНЕЦ НОВОЙ ЛОГИКИ ---

            for (const component of components) {
                // 1. Создаем родительский пункт для самого компонента
                chrome.contextMenus.create({
                    id: component.id,
                    parentId: MenuManager.CONFIG.SAVED_COMPONENTS_PARENT_ID,
                    title: component.name,
                    contexts: ['page']
                });

                // 2. Создаем дочерний пункт для удаления этого компонента
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

    /**
     * Динамически добавляет новый пункт в меню сохраненных ПРЕДЛОЖЕНИЙ.
     * @param {string} offerId - ID нового предложения
     * @param {string} offerName - Имя нового предложения
     */
    async addSavedOfferItem(offerId, offerName) {
        try {
            await chrome.contextMenus.remove(MenuManager.CONFIG.NO_SAVED_OFFERS_ID);
        } catch (e) {
            // Ошибки нет, если элемента не существует
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
     * Полностью перерисовывает меню. Используется после добавления или удаления.
     */
    async refreshMenu() {
        await this.initialize();
    }
}