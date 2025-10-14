// logger.js
// \file logger.js
// -*- coding: utf-8 -*-

/**
 * Модуль логирования событий расширения
 * =====================================
 * Класс Logger реализует асинхронное логирование с сохранением в chrome.storage
 */

/**
 * Класс для логирования событий расширения
 * Сохраняет логи в chrome.storage.local с ограничением количества записей
 */
class Logger {
    /**
     * Конструктор логгера
     * 
     * Args:
     *     storageKey (string): Ключ для хранения логов в storage (по умолчанию '__kazarinov_logs__')
     *     maxLogs (number): Максимальное количество хранимых логов (по умолчанию 100)
     */
    constructor(storageKey = '__kazarinov_logs__', maxLogs = 100) {
        this.storageKey = storageKey;
        this.maxLogs = maxLogs;
    }

    /**
     * Основной метод логирования
     * Функция записывает лог в консоль и сохраняет в storage
     * 
     * Args:
     *     level (string): Уровень логирования ('info', 'warn', 'error', 'debug')
     *     message (string): Текст сообщения
     *     extra (Object|null): Дополнительные данные для логирования (по умолчанию null)
     */
    log(level, message, extra = null) {
        const timestamp = new Date().toISOString();
        const logEntry = { timestamp, level, message, extra };

        const extraDetails = extra ? extra : '';

        switch (level) {
            case 'info':
                console.info(`[INFO] [${timestamp}] ${message}`, extraDetails);
                break;
            case 'warn':
                console.warn(`[WARN] [${timestamp}] ${message}`, extraDetails);
                break;
            case 'error':
                console.error(`[ERROR] [${timestamp}] ${message}`, extraDetails);
                break;
            case 'debug':
                console.debug(`[DEBUG] [${timestamp}] ${message}`, extraDetails);
                break;
            default:
                console.log(`[LOG] [${timestamp}] ${message}`, extraDetails);
        }

        this._saveLogEntry(logEntry);
    }

    /**
     * Сохранение записи лога в storage
     * Функция добавляет запись в хранилище и обрезает массив до maxLogs
     * 
     * Args:
     *     logEntry (Object): Объект записи лога
     */
    _saveLogEntry(logEntry) {
        this._getStoredLogs().then(data => {
            data.push(logEntry);
            if (data.length > this.maxLogs) {
                data.splice(0, data.length - this.maxLogs);
            }
            return chrome.storage.local.set({ [this.storageKey]: data });
        }).catch(ex => {
            console.error('[Logger] Критическая ошибка сохранения лога:', ex);
        });
    }

    /**
     * Логирование информационного сообщения
     * 
     * Args:
     *     message (string): Текст сообщения
     *     extra (Object|null): Дополнительные данные (по умолчанию null)
     */
    info(message, extra = null) {
        this.log('info', message, extra);
    }

    /**
     * Логирование предупреждения
     * 
     * Args:
     *     message (string): Текст сообщения
     *     extra (Object|null): Дополнительные данные (по умолчанию null)
     */
    warn(message, extra = null) {
        this.log('warn', message, extra);
    }

    /**
     * Логирование ошибки
     * 
     * Args:
     *     message (string): Текст сообщения
     *     extra (Object|null): Дополнительные данные (по умолчанию null)
     */
    error(message, extra = null) {
        this.log('error', message, extra);
    }

    /**
     * Логирование отладочного сообщения
     * 
     * Args:
     *     message (string): Текст сообщения
     *     extra (Object|null): Дополнительные данные (по умолчанию null)
     */
    debug(message, extra = null) {
        this.log('debug', message, extra);
    }

    /**
     * Получение сохраненных логов из storage
     * 
     * Returns:
     *     Promise<Array>: Массив записей логов
     */
    _getStoredLogs() {
        return new Promise((resolve) => {
            chrome.storage.local.get([this.storageKey], (result) => {
                resolve(result[this.storageKey] || []);
            });
        });
    }

    /**
     * Получение всех логов
     * 
     * Returns:
     *     Promise<Array>: Массив всех записей логов
     */
    async getLogs() {
        return await this._getStoredLogs();
    }

    /**
     * Очистка всех логов из storage
     */
    async clearLogs() {
        await chrome.storage.local.remove(this.storageKey);
    }
}