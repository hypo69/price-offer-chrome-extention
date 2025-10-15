// logger.js

class Logger {
    constructor(storageKey = '__kazarinov_logs__', maxLogs = 100) {
        this.storageKey = storageKey;
        this.maxLogs = maxLogs;
    }

    log(level, message, extra = null) {
        const timestamp = new Date().toISOString();
        const logEntry = { timestamp, level, message, extra };
        const extraDetails = extra ? extra : '';

        switch (level) {
            case 'info':
                (console.info || console.log)(`[INFO] [${timestamp}] ${message}`, extraDetails);
                break;
            case 'warn':
                (console.warn || console.log)(`[WARN] [${timestamp}] ${message}`, extraDetails);
                break;
            case 'error':
                (console.error || console.log)(`[ERROR] [${timestamp}] ${message}`, extraDetails);
                break;
            case 'debug':
                (console.debug || console.log)(`[DEBUG] [${timestamp}] ${message}`, extraDetails);
                break;
            default:
                console.log(`[LOG] [${timestamp}] ${message}`, extraDetails);
        }

        if (chrome && chrome.storage && chrome.storage.local) {
            this._saveLogEntry(logEntry);
        }
    }

    info(message, extra = null) { this.log('info', message, extra); }
    warn(message, extra = null) { this.log('warn', message, extra); }
    error(message, extra = null) { this.log('error', message, extra); }
    debug(message, extra = null) { this.log('debug', message, extra); }

    _saveLogEntry(logEntry) {
        this._getStoredLogs().then(data => {
            data.push(logEntry);
            if (data.length > this.maxLogs) {
                data.splice(0, data.length - this.maxLogs);
            }
            chrome.storage.local.set({ [this.storageKey]: data });
        }).catch(ex => {
            console.error('[Logger] Критическая ошибка сохранения лога:', ex);
        });
    }

    _getStoredLogs() {
        return new Promise(resolve => {
            chrome.storage.local.get([this.storageKey], (result) => {
                resolve(result[this.storageKey] || []);
            });
        });
    }

    async getLogs() { return await this._getStoredLogs(); }
    async clearLogs() { await chrome.storage.local.remove(this.storageKey); }
}

const logger = new Logger();