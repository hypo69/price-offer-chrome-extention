// result.js

/**
 * Модуль отображения результатов предложения цены
 * ===============================================
 * Загрузка и отображение последнего сформированного предложения
 */

const logger = new Logger('__kazarinov_logs__', 100);

/**
 * Загрузка и отображение последнего предложения
 * Функция извлекает данные из chrome.storage и отображает их
 */
async function loadLastOffer() {
    const resultElement = document.getElementById('result');

    try {
        await logger.info('Загрузка последнего предложения');

        chrome.storage.local.get(['lastOffer'], async (res) => {
            if (chrome.runtime.lastError) {
                throw new Error(chrome.runtime.lastError.message);
            }

            const data = res.lastOffer || { error: 'Нет данных' };

            try {
                const formattedData = typeof data === 'string'
                    ? JSON.stringify(JSON.parse(data), null, 2)
                    : JSON.stringify(data, null, 2);

                resultElement.textContent = formattedData;

                await logger.info('Последнее предложение загружено', {
                    dataLength: formattedData.length
                });
            } catch (parseError) {
                resultElement.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2);

                await logger.warn('Данные предложения не в формате JSON', {
                    error: parseError.message
                });
            }
        });

    } catch (ex) {
        resultElement.textContent = `Ошибка загрузки данных: ${ex.message}`;
        await logger.error('Ошибка загрузки последнего предложения', {
            error: ex.message,
            stack: ex.stack
        });
    }
}

/**
 * Копирование содержимого в буфер обмена
 * Функция копирует JSON-данные предложения в clipboard
 */
async function copyToClipboard() {
    const resultElement = document.getElementById('result');
    const copyButton = document.getElementById('copy');
    const originalText = copyButton.textContent;

    try {
        await navigator.clipboard.writeText(resultElement.textContent);

        copyButton.textContent = 'Скопировано!';
        copyButton.style.background = '#0f9d58';

        await logger.info('Содержимое предложения скопировано в буфер обмена');

        setTimeout(() => {
            copyButton.textContent = originalText;
            copyButton.style.background = '';
        }, 1500);

    } catch (ex) {
        copyButton.textContent = 'Ошибка!';
        copyButton.style.background = '#db4437';

        await logger.error('Ошибка копирования в буфер обмена', {
            error: ex.message,
            stack: ex.stack
        });

        setTimeout(() => {
            copyButton.textContent = originalText;
            copyButton.style.background = '';
        }, 1500);
    }
}

/**
 * Инициализация страницы результатов
 * Функция загружает данные и привязывает обработчики событий
 */
document.addEventListener('DOMContentLoaded', async () => {
    await logger.info('Инициализация страницы результатов');

    await loadLastOffer();

    document.getElementById('copy').addEventListener('click', copyToClipboard);

    await logger.debug('Страница результатов готова к работе');
});