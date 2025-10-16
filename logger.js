// logger.js

const MAX_STORAGE_SIZE_BYTES = 5 * 1024 * 1024; // Лимит chrome.storage.local по умолчанию - 5 МБ

class Logger {
    constructor(logsKey = '__kazarinov_all_logs__', errorFileKey = '__kazarinov_error_file__', maxLogs = 100) {
        this.logsKey = logsKey; // Ключ для хранения всех структурированных логов (массив)
        this.errorFileKey = errorFileKey; // Ключ для хранения файла ошибок (одна строка)
        this.maxLogs = maxLogs;
    }

    log(level, message, extra = null) {
        const timestamp = new Date().toISOString();
        const logEntry = { timestamp, level, message, extra };

        // 1. Логирование в консоль (только INFO)
        if (level === 'info') {
            (console.info || console.log)(`[INFO] [${timestamp}] ${message}`, extra);
        } else if (level === 'debug') {
            (console.debug || console.log)(`[DEBUG] [${timestamp}] ${message}`, extra);
        }
        // WARN и ERROR идут в файл, но не в console.warn/error

        if (chrome && chrome.storage && chrome.storage.local) {
            // 2. Сохранение всех логов в массив (для debug-страницы)
            this._saveStructuredLog(logEntry);

            // 3. Сохранение WARN/ERROR в файл-строку
            if (level === 'error' || level === 'warn') {
                this._appendToFileLog(logEntry);
            }
        }
    }

    info(message, extra = null) { this.log('info', message, extra); }
    warn(message, extra = null) { this.log('warn', message, extra); }
    error(message, extra = null) { this.log('error', message, extra); }
    debug(message, extra = null) { this.log('debug', message, extra); }

    // --- Методы для работы со структурированным массивом логов ---

    _saveStructuredLog(logEntry) {
        this._getStructuredLogs().then(data => {
            data.push(logEntry);
            if (data.length > this.maxLogs) {
                data.splice(0, data.length - this.maxLogs);
            }
            chrome.storage.local.set({ [this.logsKey]: data });
        }).catch(ex => {
            console.error('[Logger] Критическая ошибка сохранения структурированного лога:', ex);
        });
    }

    _getStructuredLogs() {
        return new Promise(resolve => {
            chrome.storage.local.get([this.logsKey], (result) => {
                resolve(result[this.logsKey] || []);
            });
        });
    }

    // Метод, который использует debug.js для отображения
    async getLogs() { return await this._getStructuredLogs(); }

    // Метод, который использует debug.js для очистки всех логов
    async clearLogs() {
        await chrome.storage.local.remove(this.logsKey);
        await this.clearErrorFile(); // Очищаем и файл ошибок
    }

    // --- Методы для работы с файлом ошибок (строкой) ---

    _formatFileEntry(logEntry) {
        const extra = logEntry.extra
            ? `\n--- DETAILS ---\n${JSON.stringify(logEntry.extra, null, 2)}\n--- END DETAILS ---`
            : '';
        return `[${logEntry.timestamp}] [${logEntry.level.toUpperCase()}] ${logEntry.message}${extra}\n========================================\n`;
    }

    _appendToFileLog(logEntry) {
        this.getErrorFileContent().then(fileContent => {
            const newEntry = this._formatFileEntry(logEntry);
            let updatedContent = fileContent + newEntry;

            // Простая оценка размера в байтах: 2 байта на символ
            if (updatedContent.length * 2 > MAX_STORAGE_SIZE_BYTES) {
                // Если превышен лимит, обрезаем старые записи с начала
                const overflow = updatedContent.length * 2 - MAX_STORAGE_SIZE_BYTES;
                // Обрезаем, удаляя первые символы
                updatedContent = updatedContent.substring(Math.floor(overflow / 2));
                // Ищем начало последней полной записи, чтобы избежать обрезки посередине
                const firstDelimiter = updatedContent.indexOf('========================================\n');
                if (firstDelimiter !== -1) {
                    updatedContent = updatedContent.substring(firstDelimiter + '========================================\n'.length);
                }
            }

            chrome.storage.local.set({ [this.errorFileKey]: updatedContent });
        }).catch(ex => {
            console.error('[Logger] Критическая ошибка сохранения файла логов:', ex);
        });
    }

    async getErrorFileContent() {
        return new Promise(resolve => {
            chrome.storage.local.get([this.errorFileKey], (result) => {
                resolve(result[this.errorFileKey] || '');
            });
        });
    }

    async clearErrorFile() { await chrome.storage.local.remove(this.errorFileKey); }
}

// Глобальное объявление экземпляра
const logger = new Logger();