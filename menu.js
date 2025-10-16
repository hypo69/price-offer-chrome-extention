// menu.js
// \file menu.js
// -*- coding: utf-8 -*-

class MenuManager {
    static CONFIG = {
        GENERATE_OFFER_PARENT_ID: 'generate-offer-parent',
        ADD_COMPONENT_ID: 'add-component-action',
        SAVED_COMPONENTS_PARENT_ID: 'saved-components-parent',
        CLEAR_ALL_COMPONENTS_ID: 'clear-all-components-action' // НОВЫЙ ID для очистки
    };
    static STORAGE_KEY = 'addedComponents';

    constructor(logger) {
        this.logger = logger;
        // Карта для красивых названий языков
        this.languageNames = {
            ru: 'на Русском',
            en: 'in English',
            he: 'בעברית',
            it: 'in Italiano',
            pl: 'po Polsku',
            uk: 'українською'
        };
    }

    async initialize() {
        await chrome.contextMenus.removeAll();

        chrome.contextMenus.create({
            id: MenuManager.CONFIG.ADD_COMPONENT_ID,
            title: 'Добавить компонент',
            contexts: ['page']
        });

        await this._createSavedComponentsMenu();
        await this.logger.info('Контекстное меню инициализировано');
    }

    async _createSavedComponentsMenu() {
        const { [MenuManager.STORAGE_KEY]: components = [] } = await chrome.storage.local.get(MenuManager.STORAGE_KEY);

        if (components.length === 0) {
            // Пункт "Сохраненные компоненты" не создается, если нет ни одного компонента.
            await this.logger.info('Нет сохраненных компонентов, меню генерации не создано.');
            return;
        }

        // 1. Создаем родительский пункт для всех сохраненных компонентов
        chrome.contextMenus.create({
            id: MenuManager.CONFIG.SAVED_COMPONENTS_PARENT_ID,
            title: 'Сохраненные компоненты',
            contexts: ['page']
        });

        // 2. Создаем подменю для генерации оффера
        chrome.contextMenus.create({
            id: MenuManager.CONFIG.GENERATE_OFFER_PARENT_ID,
            parentId: MenuManager.CONFIG.SAVED_COMPONENTS_PARENT_ID,
            title: 'Сформировать предложение цены',
            contexts: ['page']
        });

        // ▼▼▼ ЛОГИКА ДИНАМИЧЕСКОГО ПОДМЕНЮ ЯЗЫКОВ ▼▼▼
        try {
            const manifestUrl = chrome.runtime.getURL('locales-manifest.json');
            const response = await fetch(manifestUrl);
            const locales = await response.json();

            if (Array.isArray(locales)) {
                locales.forEach(locale => {
                    chrome.contextMenus.create({
                        id: `generate-offer-lang-${locale}`, // Уникальный ID для каждого языка
                        parentId: MenuManager.CONFIG.GENERATE_OFFER_PARENT_ID,
                        title: this.languageNames[locale] || locale, // Используем красивое имя или код языка
                        contexts: ['page']
                    });
                });
                this.logger.info(`Создано подменю для ${locales.length} языков.`);
            }
        } catch (error) {
            this.logger.error('Не удалось создать подменю языков', { error: error.message });
            // Создаем запасной пункт меню, если манифест не загрузился
            chrome.contextMenus.create({
                id: 'generate-offer-lang-default',
                parentId: MenuManager.CONFIG.GENERATE_OFFER_PARENT_ID,
                title: 'По умолчанию',
                contexts: ['page']
            });
        }
        // ▲▲▲ КОНЕЦ ЛОГИКИ ПОДМЕНЮ ЯЗЫКОВ ▲▲▲

        // 3. Разделитель после подменю генерации
        chrome.contextMenus.create({
            id: 'components-action-separator-1',
            parentId: MenuManager.CONFIG.SAVED_COMPONENTS_PARENT_ID,
            type: 'separator',
            contexts: ['page']
        });

        // 4. Создаем пункты для каждого компонента
        for (const component of components) {
            chrome.contextMenus.create({
                id: component.id,
                parentId: MenuManager.CONFIG.SAVED_COMPONENTS_PARENT_ID,
                title: component.name,
                contexts: ['page']
            });
            // Добавляем подпункт для удаления компонента
            chrome.contextMenus.create({
                id: `delete-${component.id}`,
                parentId: component.id,
                title: '❌ Удалить',
                contexts: ['page']
            });
        }

        // 5. Разделитель перед "Очистить все"
        chrome.contextMenus.create({
            id: 'components-action-separator-2',
            parentId: MenuManager.CONFIG.SAVED_COMPONENTS_PARENT_ID,
            type: 'separator',
            contexts: ['page']
        });

        // 6. ▼▼▼ НОВЫЙ ПУНКТ: Очистить все компоненты (Всегда последний) ▼▼▼
        chrome.contextMenus.create({
            id: MenuManager.CONFIG.CLEAR_ALL_COMPONENTS_ID,
            parentId: MenuManager.CONFIG.SAVED_COMPONENTS_PARENT_ID,
            title: '💣 Очистить все компоненты', // Броский заголовок для опасного действия
            contexts: ['page']
        });

        await this.logger.info(`Загружено ${components.length} сохраненных компонентов в меню`);
    }

    async addSavedOfferItem(offerId, offerName) { /* ... без изменений ... */ }

    // Вспомогательный метод для обновления меню
    async refreshMenu() {
        await this.initialize();
    }
}