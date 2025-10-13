// debug.js

document.addEventListener('DOMContentLoaded', () => {
    // Создаем экземпляр логгера, чтобы получить доступ к его методам
    const logger = new Logger('__kazarinov_logs__');
    const logContainer = document.getElementById('logContainer');

    const displayLogs = async () => {
        const logs = await logger.getLogs();
        if (logs.length === 0) {
            logContainer.textContent = 'Логи пусты.';
            return;
        }
        // Форматируем для красивого вывода
        const formattedLogs = logs.map(log =>
            `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}` +
            (log.extra ? `\n${JSON.stringify(log.extra, null, 2)}` : '')
        ).join('\n\n');
        logContainer.textContent = formattedLogs;
    };

    // Кнопка скачивания
    document.getElementById('downloadLogs').addEventListener('click', async () => {
        const logs = await logger.getLogs();
        if (logs.length === 0) {
            alert('Логи пусты, нечего скачивать.');
            return;
        }

        const textToSave = logs.map(log =>
            `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}` +
            (log.extra ? `\n--- DETAILS ---\n${JSON.stringify(log.extra, null, 2)}\n--- END DETAILS ---` : '')
        ).join('\n========================================\n');

        const blob = new Blob([textToSave], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'error.log'; // Имя файла для сохранения
        a.click();
        URL.revokeObjectURL(url);
    });

    // Кнопка очистки
    document.getElementById('clearLogs').addEventListener('click', async () => {
        if (confirm('Вы уверены, что хотите удалить все логи?')) {
            await logger.clearLogs();
            await displayLogs();
        }
    });

    // Отображаем логи при загрузке страницы
    displayLogs();
});