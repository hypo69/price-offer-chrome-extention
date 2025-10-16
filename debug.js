// debug.js

/
 * Модуль просмотра и управления логами расширения
 * ===============================================
 * Интерфейс для просмотра, скачивания и очистки логов
 */

const logger = new Logger('__kazarinov_logs__');
const logContainer = document.getElementById('logContainer');

/
 * Отображение логов в контейнере
 * Функция загружает логи из хранилища и форматирует их для отображения
 */
async function displayLogs() {
    try {
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

/
 * Скачивание логов в файл
 * Функция экспортирует все логи в текстовый файл error.log
 */
async function downloadLogs() {
    try {
        const logs = await logger.getLogs();

        if (logs.length === 0) {
            alert('Логи пусты, нечего скачивать.');
            console.warn('[Debug] Попытка скачать пустые логи');
            return;
        }

        const textToSave = logs.map(log => {
            const timestamp = log.timestamp;
            const level = log.level.toUpperCase();
            const message = log.message;
            const extra = log.extra
                ? `\n--- DETAILS ---\n${JSON.stringify(log.extra, null, 2)}\n--- END DETAILS ---`
                : '';

            return `[${timestamp}] [${level}] ${message}${extra}`;
        }).join('\n========================================\n');

        const blob = new Blob([textToSave], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'error.log';
        a.click();
        URL.revokeObjectURL(url);

        console.info('[Debug] Логи успешно скачаны', { logsCount: logs.length });

    } catch (ex) {
        alert(`Ошибка скачивания логов: ${ex.message}`);
        console.error('[Debug] Ошибка скачивания логов:', ex);
    }
}

/
 * Очистка всех логов
 * Функция удаляет все логи из хранилища после подтверждения
 */
async function clearLogs() {
    try {
        const confirmed = confirm('Вы уверены, что хотите удалить все логи?');

        if (!confirmed) {
            console.info('[Debug] Очистка логов отменена пользователем');
            return;
        }

        await logger.clearLogs();
        await displayLogs();

        console.info('[Debug] Логи успешно очищены');

    } catch (ex) {
        alert(`Ошибка очистки логов: ${ex.message}`);
        console.error('[Debug] Ошибка очистки логов:', ex);
    }
}

/
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