// logger.js

class Logger {
    constructor(storageKey = '__kazarinov_logs__', maxLogs = 100) {
        this.storageKey = storageKey;
        this.maxLogs = maxLogs;
    }

    async log(level, message, extra = null) {
        const timestamp = new Date().toISOString();
        const logEntry = { timestamp, level, message, extra };

        // Улучшенный вывод в консоль, который показывает и сообщение, и доп. данные
        const extraDetails = extra ? extra : '';

        switch (level) {
            case 'info': console.info(`[INFO] [${timestamp}] ${message}`, extraDetails); break;
            case 'warn': console.warn(`[WARN] [${timestamp}] ${message}`, extraDetails); break;
            case 'error': console.error(`[ERROR] [${timestamp}] ${message}`, extraDetails); break;
            case 'debug': console.debug(`[DEBUG] [${timestamp}] ${message}`, extraDetails); break;
            default: console.log(`[LOG] [${timestamp}] ${message}`, extraDetails);
        }

        try {
            const data = await this._getStoredLogs();
            data.push(logEntry);
            if (data.length > this.maxLogs) data.splice(0, data.length - this.maxLogs);
            await chrome.storage.local.set({ [this.storageKey]: data });
        } catch (ex) {
            console.error('[Logger] Критическая ошибка сохранения лога:', ex);
        }
    }

    async info(message, extra = null) { return this.log('info', message, extra); }
    async warn(message, extra = null) { return this.log('warn', message, extra); }
    async error(message, extra = null) { return this.log('error', message, extra); }
    async debug(message, extra = null) { return this.log('debug', message, extra); }

    async _getStoredLogs() {
        return new Promise((resolve) => {
            chrome.storage.local.get([this.storageKey], (result) => {
                resolve(result[this.storageKey] || []);
            });
        });
    }

    async getLogs() {
        return await this._getStoredLogs();
    }

    async clearLogs() {
        await chrome.storage.local.remove(this.storageKey);
    }
}