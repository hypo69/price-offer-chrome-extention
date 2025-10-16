// debug.js

/**
 * Модуль просмотра и управления логами расширения
 * ===============================================
 * Интерфейс для просмотра, скачивания и очистки логов
 */

// logger объявлен в logger.js, здесь просто используем его
// const logger = new Logger('__kazarinov_logs__'); // Удалено, чтобы избежать конфликта с logger.js
const logContainer = document.getElementById('logContainer');

/**
 * Отображение логов в контейнере
 * Функция загружает структурированные логи из хранилища и форматирует их для отображения
 */
async function displayLogs() {
    try {
        // Используем метод для получения структурированных логов
        const logs = await logger.getLogs();

        if (logs.length === 0) {
            logContainer.textContent = 'Логи пусты.';
            console.info('[Debug] Логи отсутствуют');
            return;
        }

        const formattedLogs = logs.map(log => {
            const timestamp = log.timestamp;
            const level = log.level.toUpperCase();
            const message = log.message;
            const extra = log.extra ? `\n${JSON.stringify(log.extra, null, 2)}` : '';

            return `[${timestamp}] [${level}] ${message}${extra}`;
        }).join('\n\n');

        logContainer.textContent = formattedLogs;
        console.info('[Debug] Отображено логов:', logs.length);

    } catch (ex) {
        logContainer.textContent = `Ошибка загрузки логов: ${ex.message}`;
        console.error('[Debug] Ошибка отображения логов:', ex);
    }
}

/**
 * Скачивание логов в файл
 * Функция экспортирует **файл ошибок** (error.log)
 */
async function downloadLogs() {
    try {
        // Используем метод для получения содержимого файла ошибок (только WARN/ERROR)
        const textToSave = await logger.getErrorFileContent();

        if (textToSave.length === 0) {
            alert('Файл ошибок пуст, нечего скачивать.');
            console.warn('[Debug] Попытка скачать пустой файл ошибок');
            return;
        }

        const blob = new Blob([textToSave], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'error.log';
        a.click();
        URL.revokeObjectURL(url);

        console.info('[Debug] Файл ошибок успешно скачан');

    } catch (ex) {
        alert(`Ошибка скачивания логов: ${ex.message}`);
        console.error('[Debug] Ошибка скачивания логов:', ex);
    }
}

/**
 * Очистка всех логов
 * Функция удаляет все логи (структурированные и файл ошибок)
 */
async function clearLogs() {
    try {
        const confirmed = confirm('Вы уверены, что хотите удалить все логи и файл ошибок?');

        if (!confirmed) {
            console.info('[Debug] Очистка логов отменена пользователем');
            return;
        }

        await logger.clearLogs(); // Очистит оба хранилища
        await displayLogs();

        console.info('[Debug] Логи и файл ошибок успешно очищены');

    } catch (ex) {
        alert(`Ошибка очистки логов: ${ex.message}`);
        console.error('[Debug] Ошибка очистки логов:', ex);
    }
}

/**
 * Инициализация интерфейса просмотра логов
 * Функция привязывает обработчики событий к кнопкам
 */
document.addEventListener('DOMContentLoaded', async () => {
    console.info('[Debug] Инициализация интерфейса просмотра логов');

    document.getElementById('downloadLogs').addEventListener('click', downloadLogs);
    document.getElementById('clearLogs').addEventListener('click', clearLogs);

    await displayLogs();

    console.info('[Debug] Интерфейс просмотра логов готов');
});