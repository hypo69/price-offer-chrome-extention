// preview-offer.js (или внутри <script> в preview-offer.html)
// Добавьте эту функцию в свой основной скрипт для страницы превью.

/**
 * Глобальная функция для отображения ошибки на странице Preview с кнопкой повтора.
 * 
 * @param {string} message Сообщение об ошибке.
 * @param {boolean} showRepeat Показывать ли кнопку "Повторить запрос".
 * @param {object|null} repeatData Данные для повтора {tabId, lang}.
 */
window.showPreviewError = function (message, showRepeat = false, repeatData = null) {
    const errorContainerId = 'preview-error-notification';
    let container = document.getElementById(errorContainerId);

    if (!container) {
        // Создаем контейнер для ошибки (если его нет в HTML)
        container = document.createElement('div');
        container.id = errorContainerId;
        container.style.cssText = `
            margin: 20px auto; 
            padding: 15px; 
            border: 1px solid #db4437; 
            background: #ffe3e3; 
            color: #db4437; 
            border-radius: 8px; 
            max-width: 800px;
            text-align: left;
        `;
        // Предполагаем, что есть элемент, в который мы его добавим, 
        // например, тело документа или главный контейнер.
        document.body.prepend(container);
    }

    container.innerHTML = `<strong>КРИТИЧЕСКАЯ ОШИБКА:</strong> ${message}<div id="preview-repeat-button-container" style="margin-top: 10px;"></div>`;

    if (showRepeat && repeatData) {
        const repeatContainer = document.getElementById('preview-repeat-button-container');
        const repeatButton = document.createElement('button');

        repeatButton.textContent = 'Повторить запрос'; // ИЗМЕНЕНО
        repeatButton.style.cssText = `
            padding: 8px 15px; 
            background-color: #db4437; 
            color: white; 
            border: none; 
            border-radius: 4px; 
            cursor: pointer;
            font-weight: bold;
            transition: background-color 0.2s;
        `;

        repeatButton.onclick = () => {
            container.innerHTML = 'Повтор запроса...';
            // Вызываем функцию, которая повторит весь цикл генерации
            handleRepeatGeneration(repeatData.tabId, repeatData.lang);
        };

        repeatContainer.appendChild(repeatButton);
    }
};

/**
 * Имитация функции handleGenerateOffer для повтора запроса с preview-offer.
 * 
 * ВНИМАНИЕ: Эта функция должна находиться в том же скрипте, что и GeminiAPI,
 * и должна иметь доступ к logger.
 * 
 * @param {number} tabId ID вкладки, откуда был инициирован запрос (для UI).
 * @param {string} lang Код языка.
 */
async function handleRepeatGeneration(tabId, lang) {
    // Отправляем сообщение в Service Worker (background.js)
    try {
        const response = await chrome.runtime.sendMessage({
            action: 'repeatFullGeneration',
            data: { tabId, lang }
        });

        if (response.status === 'ok') {
            // Если background.js успешно запустил, он обновит эту вкладку.
            console.log('Повторная генерация инициирована Service Worker.');
            showPreviewError('Повторный запрос отправлен. Ожидайте обновления.', false);
        } else {
            // Если Service Worker вернул ошибку
            showPreviewError(`Ошибка при повторном инициировании: ${response.message}`, true, { tabId, lang });
        }
    } catch (error) {
        // Если Service Worker недоступен
        showPreviewError(`Не удалось связаться с Service Worker для повтора: ${error.message}`, true, { tabId, lang });
    }
}