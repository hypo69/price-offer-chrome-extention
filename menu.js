// menu.js
// \file menu.js
// -*- coding: utf-8 -*-

/**
 * Модуль для управления контекстным меню расширения
 * ==================================================
 * Создание и обновление структуры контекстного меню
 * ВАЖНО: Обработка кликов по меню происходит в background.js
 *
 * Этот файл — объединённая, финальная версия MenuManager:
 * - включает функционал из обеих версий (языки, savedOffers, очистка)
 * - класс объявлён единожды
 */

class MenuManager {
    /**
     * Конфигурация идентификаторов пунктов меню
     */
    static CONFIG = {
        // генерировать оффер - оставляем оба ключа как алиасы, чтобы совместимость с разными местами вызова была сохранена
        GENERATE_OFFER_FROM_COMPONENTS_ID: 'generate-offer-parent',
        GENERATE_OFFER_PARENT_ID: 'generate-offer-parent',

        ADD_COMPONENT_ID: 'add-component-action',
        SAVED_COMPONENTS_PARENT_ID: 'saved-components-parent',

        // Основной ID для очистки — используем короткий и стабильный вариант.
        CLEAR_ALL_COMPONENTS_ID: 'clear-all-components',
        // старые варианты, которые могли где-то использоваться — алиасы
        CLEAR_ALL_COMPONENTS_ACTION_ID: 'clear-all-components-action'
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
        this.languageNames = {
            ru: 'на Русском',
            en: 'in English',
            he: 'בעברית',
            it: 'in Italiano',
            pl: 'po Polsku',
            uk: 'українською'
        };

        // Защита: если logger отсутствует — используем заглушку, чтобы не ломать вызовы.
        if (!this.logger) {
            this.logger = {
                debug: () => {},
                info: () => {},
                warn: () => {},
                error: () => {}
            };
        }

        this.logger.debug('MenuManager инициализирован (конструктор)');
    }

    /**
     * Инициализация контекстного меню
     * Функция создает структуру меню с компонентами
     */
    async initialize() {
        this.logger.info('Начало инициализации контекстного меню');

        try {
            // Удаляем старые элементы
            try {
                chrome.contextMenus.removeAll();
                this.logger.debug('Все существующие пункты меню удалены');
            } catch (rmEx) {
                // Иногда removeAll может выбросить, но продолжаем попытку.
                this.logger.warn('chrome.contextMenus.removeAll выбросил исключение', { error: rmEx?.message ?? rmEx });
            }

            // Добавляем основной пункт "Добавить компонент"
            try {
                chrome.contextMenus.create({
                    id: MenuManager.CONFIG.ADD_COMPONENT_ID,
                    title: 'Добавить компонент',
                    contexts: ['page']
                });
                this.logger.debug('Создан пункт меню "Добавить компонент"');
            } catch (ex) {
                this.logger.error('Ошибка при создании пункта "Добавить компонент"', { error: ex?.message ?? ex });
            }

            // Создаем подменю сохранённых компонентов (если есть)
            await this._createSavedComponentsMenu();

            this.logger.info('Контекстное меню инициализировано успешно');
        } catch (ex) {
            this.logger.error('Ошибка инициализации контекстного меню', {
                error: ex.message,
                stack: ex.stack
            });
            throw ex;
        }
    }

    /**
     * Создание подменю сохраненных компонентов
     * Функция загружает компоненты из storage и создает пункты меню
     */
    async _createSavedComponentsMenu() {
        this.logger.debug('Загрузка сохраненных компонентов из storage');

        try {
            const storageResult = await chrome.storage.local.get(MenuManager.STORAGE_KEY);
            const components = storageResult?.[MenuManager.STORAGE_KEY] ?? [];

            if (!Array.isArray(components) || components.length === 0) {
                this.logger.info('Нет сохраненных компонентов для отображения в меню');
                return;
            }

            this.logger.debug('Создание родительского пункта меню компонентов', { componentsCount: components.length });

            // Родительский пункт "Сохраненные компоненты"
            try {
                chrome.contextMenus.create({
                    id: MenuManager.CONFIG.SAVED_COMPONENTS_PARENT_ID,
                    title: 'Сохраненные компоненты',
                    contexts: ['page']
                });
            } catch (ex) {
                this.logger.error('Ошибка создания родительского пункта "Сохраненные компоненты"', { error: ex?.message ?? ex });
            }

            // Подменю: Сформировать предложение цены
            try {
                chrome.contextMenus.create({
                    id: MenuManager.CONFIG.GENERATE_OFFER_FROM_COMPONENTS_ID,
                    parentId: MenuManager.CONFIG.SAVED_COMPONENTS_PARENT_ID,
                    title: 'Сформировать предложение цены',
                    contexts: ['page']
                });
                this.logger.debug('Создан пункт "Сформировать предложение цены"');
            } catch (ex) {
                this.logger.error('Ошибка создания пункта "Сформировать предложение цены"', { error: ex?.message ?? ex });
            }

            // Динамическое подменю языков (locales-manifest.json в web_accessible_resources)
            try {
                const manifestUrl = chrome.runtime.getURL('locales-manifest.json');
                const response = await fetch(manifestUrl);
                const locales = await response.json();

                if (Array.isArray(locales) && locales.length > 0) {
                    locales.forEach(locale => {
                        try {
                            chrome.contextMenus.create({
                                id: `generate-offer-lang-${locale}`,
                                parentId: MenuManager.CONFIG.GENERATE_OFFER_FROM_COMPONENTS_ID,
                                title: this.languageNames[locale] || locale,
                                contexts: ['page']
                            });
                        } catch (innerEx) {
                            this.logger.warn('Не удалось создать пункт языка', { locale, error: innerEx?.message ?? innerEx });
                        }
                    });
                    this.logger.info(`Создано подменю для ${locales.length} языков.`);
                } else {
                    this.logger.debug('Locales manifest пуст или не массив');
                }
            } catch (ex) {
                this.logger.error('Не удалось создать подменю языков', { error: ex?.message ?? ex });
                // Фолбэк: создаём один пункт "По умолчанию"
                try {
                    chrome.contextMenus.create({
                        id: 'generate-offer-lang-default',
                        parentId: MenuManager.CONFIG.GENERATE_OFFER_FROM_COMPONENTS_ID,
                        title: 'По умолчанию',
                        contexts: ['page']
                    });
                } catch (createEx) {
                    this.logger.warn('Не удалось создать запасной пункт "По умолчанию"', { error: createEx?.message ?? createEx });
                }
            }

            // Разделитель после подменю генерации
            try {
                chrome.contextMenus.create({
                    id: 'components-action-separator',
                    parentId: MenuManager.CONFIG.SAVED_COMPONENTS_PARENT_ID,
                    type: 'separator',
                    contexts: ['page']
                });
            } catch (ex) {
                this.logger.debug('Не удалось создать separator после генерации', { error: ex?.message ?? ex });
            }

            // Пункты для каждого компонента
            for (const component of components) {
                try {
                    if (!component || !component.id || !component.name) {
                        this.logger.warn('Пропускаем некорректный компонент при создании меню', { component });
                        continue;
                    }

                    chrome.contextMenus.create({
                        id: component.id,
                        parentId: MenuManager.CONFIG.SAVED_COMPONENTS_PARENT_ID,
                        title: component.name,
                        contexts: ['page']
                    });

                    // подпункт удаления конкретного компонента
                    chrome.contextMenus.create({
                        id: `delete-${component.id}`,
                        parentId: component.id,
                        title: '❌ Удалить',
                        contexts: ['page']
                    });

                    this.logger.debug('Создан пункт меню для компонента', { componentId: component.id, componentName: component.name });
                } catch (ex) {
                    this.logger.error('Ошибка создания пункта меню для компонента', {
                        componentId: component?.id,
                        error: ex?.message ?? ex
                    });
                }
            }

            // Разделитель перед "Очистить все"
            try {
                chrome.contextMenus.create({
                    id: 'components-clear-separator',
                    parentId: MenuManager.CONFIG.SAVED_COMPONENTS_PARENT_ID,
                    type: 'separator',
                    contexts: ['page']
                });
            } catch (ex) {
                this.logger.debug('Не удалось создать separator перед очисткой', { error: ex?.message ?? ex });
            }

            // Финальный пункт: Очистить все компоненты
            try {
                chrome.contextMenus.create({
                    id: MenuManager.CONFIG.CLEAR_ALL_COMPONENTS_ID,
                    parentId: MenuManager.CONFIG.SAVED_COMPONENTS_PARENT_ID,
                    title: '💣 Очистить все компоненты',
                    contexts: ['page']
                });
            } catch (ex) {
                this.logger.error('Ошибка создания пункта "Очистить все компоненты"', { error: ex?.message ?? ex });
            }

            this.logger.info('Загружено компонентов в меню', { count: components.length });

        } catch (ex) {
            this.logger.error('Ошибка создания подменю компонентов', {
                error: ex.message,
                stack: ex.stack
            });
            throw ex;
        }
    }

    /**
     * Добавление пункта сохраненного предложения
     * Функция добавляет новое предложение в storage и добавляет в меню
     *
     * Args:
     *     offerId (string): ID предложения
     *     offerName (string): Название предложения
     */
    async addSavedOfferItem(offerId, offerName) {
        this.logger.info('Добавление сохранённого предложения в storage и меню', { offerId, offerName });

        try {
            const stored = await chrome.storage.local.get('savedOffers');
            const savedOffers = stored?.savedOffers ?? {};

            savedOffers[offerId] = {
                name: offerName,
                data: ''
            };

            await chrome.storage.local.set({ savedOffers });

            // Добавляем пункт в меню под родителем сохранённых компонентов
            try {
                chrome.contextMenus.create({
                    id: offerId,
                    parentId: MenuManager.CONFIG.SAVED_COMPONENTS_PARENT_ID,
                    title: offerName,
                    contexts: ['page']
                });
                this.logger.info(`Сохраненное предложение "${offerName}" добавлено в меню`, { offerId });
            } catch (ex) {
                // Если создать не удалось (возможно уже существует) — логируем и продолжаем
                this.logger.warn('Не удалось создать пункт меню для сохранённого предложения', { offerId, error: ex?.message ?? ex });
            }

        } catch (ex) {
            this.logger.error('Ошибка при добавлении сохранённого предложения', { error: ex?.message ?? ex, offerId, offerName });
            throw ex;
        }
    }

    /**
     * Обновление структуры меню
     * Функция пересоздает меню с актуальными данными
     */
    async refreshMenu() {
        this.logger.info('Запрос на обновление меню');
        try {
            await this.initialize();
            this.logger.info('Меню успешно обновлено');
        } catch (ex) {
            this.logger.error('Ошибка обновления меню', {
                error: ex.message,
                stack: ex.stack
            });
            throw ex;
        }
    }
}

// Конец файла menu.js
