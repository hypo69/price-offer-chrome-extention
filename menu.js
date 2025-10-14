// menu.js
// \file menu.js
// -*- coding: utf-8 -*-

/**
 * Модуль для управления контекстным меню расширения
 * ==================================================
 * Создание и обновление структуры контекстного меню
 * ВАЖНО: Обработка кликов по меню происходит в background.js
 */

class MenuManager {
    /**
     * Конфигурация идентификаторов пунктов меню
     */
    static CONFIG = {
        GENERATE_OFFER_FROM_COMPONENTS_ID: 'generate-offer-from-components',
        ADD_COMPONENT_ID: 'add-component-action',
        SAVED_COMPONENTS_PARENT_ID: 'saved-components-parent'
    };

    /**
     * Ключ хранения компонентов в storage
     */
    static STORAGE_KEY = 'addedComponents';

    /**
     * Конструктор менеджера меню
     * 
     * Args:
     *     logger (Logger): Экземпляр логгера для записи событий
     */
    constructor(logger) {
        this.logger = logger;
    }

    /**
     * Инициализация контекстного меню
     * Функция создает структуру меню с компонентами
     */
    async initialize() {
        chrome.contextMenus.removeAll();

        chrome.contextMenus.create({
            id: MenuManager.CONFIG.ADD_COMPONENT_ID,
            title: 'Добавить компонент',
            contexts: ['page']
        });

        await this._createSavedComponentsMenu();

        await this.logger.info('Контекстное меню инициализировано');
    }

    /**
     * Создание подменю сохраненных компонентов
     * Функция загружает компоненты из storage и создает пункты меню
     */
    async _createSavedComponentsMenu() {
        const { [MenuManager.STORAGE_KEY]: components = [] } = await chrome.storage.local.get(MenuManager.STORAGE_KEY);

        if (components.length === 0) {
            await this.logger.info('Нет сохраненных компонентов для отображения в меню');
            return;
        }

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

        await this.logger.info(`Загружено ${components.length} сохраненных компонентов в меню`);
    }

    /**
     * Добавление пункта сохраненного предложения
     * Функция добавляет новое предложение в меню (зарезервировано для будущего использования)
     * 
     * Args:
     *     offerId (string): ID предложения
     *     offerName (string): Название предложения
     */
    async addSavedOfferItem(offerId, offerName) {
        await this.logger.info(`Пункт меню "${offerName}" зарегистрирован (отображение отключено).`);
    }

    /**
     * Обновление структуры меню
     * Функция пересоздает меню с актуальными данными
     */
    async refreshMenu() {
        await this.initialize();
    }
}