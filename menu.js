// menu.js
// \file menu.js
// -*- coding: utf-8 -*-

class MenuManager {
    static CONFIG = {
        GENERATE_OFFER_PARENT_ID: 'generate-offer-parent', // Изменено
        ADD_COMPONENT_ID: 'add-component-action',
        SAVED_COMPONENTS_PARENT_ID: 'saved-components-parent'
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
            await this.logger.info('Нет сохраненных компонентов, меню генерации не создано.');
            return;
        }

        chrome.contextMenus.create({
            id: MenuManager.CONFIG.SAVED_COMPONENTS_PARENT_ID,
            title: 'Сохраненные компоненты',
            contexts: ['page']
        });

        // ▼▼▼ ЛОГИКА ДИНАМИЧЕСКОГО ПОДМЕНЮ ▼▼▼
        chrome.contextMenus.create({
            id: MenuManager.CONFIG.GENERATE_OFFER_PARENT_ID,
            parentId: MenuManager.CONFIG.SAVED_COMPONENTS_PARENT_ID,
            title: 'Сформировать предложение цены',
            contexts: ['page']
        });

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
        // ▲▲▲ КОНЕЦ ЛОГИКИ ПОДМЕНЮ ▲▲▲

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
        await this.logger.info(`Загружено ${components.length} сохраненных компонентов в меню`);
    }

    async addSavedOfferItem(offerId, offerName) { /* ... без изменений ... */ }
    async refreshMenu() {
        await this.initialize();
    }
}